// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  CoffeeTraceability
 * @notice End-to-end supply-chain traceability for coffee bags.
 *         Records origin, sensor telemetry, and the full custody history on-chain.
 * @dev    Follows the Checks-Effects-Interactions (CEI) pattern throughout.
 *         Dynamic arrays inside the CoffeeBatch struct are stored in contract
 *         storage and returned as memory copies in view functions to prevent
 *         unintended mutations.
 *
 *         Gas-optimisation notes
 *         ─────────────────────
 *         • Custom errors (revert ErrorName()) cost ~50 gas less per revert than
 *           require() with a string.
 *         • `unchecked { ++batchCounter; }` avoids the overflow check that would
 *           never trigger for a uint256 in practice.
 *         • Storage pointer (`CoffeeBatch storage batch`) avoids redundant SLOADs.
 */
contract CoffeeTraceability {

    // ─────────────────────────────────────────────────────────────────────────
    // Data Structures
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Core data object representing one coffee bag / production lot.
     *
     * Temperature uses int256 (signed) so cold-chain readings below 0 °C are
     * representable. The convention is tenths of a degree (215 => 21.5 °C).
     */
    struct CoffeeBatch {
        uint256   batchId;
        string    origin;           // Farm / region of origin
        address   currentOwner;     // Wallet of current custodian
        address[] custodyTrail;     // Every handler in chronological order
        int256[]  temperatures;     // Sensor readings (tenths of a degree)
        uint256[] humidities;       // Sensor readings (0-100 %)
        uint256[] timestamps;       // block.timestamp at each sensor log
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State Variables
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Monotonically increasing counter; equals the latest valid batch ID.
    uint256 public batchCounter;

    /// @notice Primary registry mapping batchId => CoffeeBatch.
    mapping(uint256 => CoffeeBatch) private batches;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Fired when a farmer creates a new batch.
     * @param batchId  Unique identifier assigned to the new batch.
     * @param origin   Name / identifier of the originating farm.
     * @param creator  Wallet address of the farmer who created the batch.
     */
    event BatchCreated(
        uint256 indexed batchId,
        string  origin,
        address indexed creator
    );

    /**
     * @notice Fired when an IoT device pushes a new sensor reading.
     * @param batchId     The batch that received the reading.
     * @param temperature Temperature value (int256, tenths of a degree).
     * @param humidity    Humidity percentage (0-100).
     */
    event SensorDataLogged(
        uint256 indexed batchId,
        int256  temperature,
        uint256 humidity
    );

    /**
     * @notice Fired when a batch changes hands at a supply-chain checkpoint.
     * @param batchId   The batch being transferred.
     * @param oldOwner  Previous custodian's wallet address.
     * @param newOwner  New custodian's wallet address (the caller).
     */
    event CustodyTransferred(
        uint256 indexed batchId,
        address indexed oldOwner,
        address indexed newOwner
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors  (cheaper than require() strings in EVM)
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Raised when an operation references a non-existent batch ID.
    error BatchNotFound(uint256 batchId);

    /// @dev Raised when the caller is already the current owner.
    error AlreadyOwner(uint256 batchId, address caller);

    /// @dev Raised when an empty string is provided as the origin.
    error EmptyOrigin();

    /// @dev Raised when a humidity value outside [0, 100] is supplied.
    error InvalidHumidity(uint256 humidity);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Guards any function that operates on an existing batch.
     *      Valid batchIds are integers in the inclusive range [1, batchCounter].
     *      Passing 0 or a future ID both revert with BatchNotFound.
     */
    modifier batchExists(uint256 _batchId) {
        if (_batchId == 0 || _batchId > batchCounter) {
            revert BatchNotFound(_batchId);
        }
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm A – Create a New Coffee Batch
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Creates a new coffee batch and registers the caller as its first
     *         owner and the first entry in the custody trail.
     *
     * @dev    batchCounter is incremented BEFORE writing the struct so the storage
     *         slot is always written to a fresh key, eliminating any possibility
     *         of overwriting an existing batch.
     *
     * @param  _origin  Human-readable farm / region identifier. Must not be empty.
     * @return newId    The ID assigned to the newly created batch.
     *
     * Emits {BatchCreated}.
     */
    function createBatch(string calldata _origin)
        external
        returns (uint256 newId)
    {
        // ── Checks ──────────────────────────────────────────────────────────
        if (bytes(_origin).length == 0) revert EmptyOrigin();

        // ── Effects ─────────────────────────────────────────────────────────
        unchecked { ++batchCounter; }   // uint256 overflow not achievable in practice
        newId = batchCounter;

        CoffeeBatch storage batch = batches[newId];
        batch.batchId      = newId;
        batch.origin       = _origin;
        batch.currentOwner = msg.sender;
        batch.custodyTrail.push(msg.sender);   // Farmer is handler #1

        emit BatchCreated(newId, _origin, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm B – Log Sensor Data
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Appends a telemetry record (temperature + humidity + block timestamp)
     *         to an existing batch.
     *
     * @dev    Intended to be called by the Node.js backend that bridges the
     *         ESP32 IoT sensor to the blockchain. Any address may call this
     *         function — if access restriction is required in production, add an
     *         `onlyRole(SENSOR_ROLE)` modifier using OpenZeppelin's AccessControl.
     *
     *         The three arrays are parallel: index i in each array describes
     *         the same physical reading event.
     *
     * @param  _batchId     Target batch (must already exist).
     * @param  _temperature Temperature in tenths of a degree (int256 for
     *                      sub-zero support; e.g. -30 => -3.0 °C, 215 => 21.5 °C).
     * @param  _humidity    Relative humidity percentage. Must be in [0, 100].
     *
     * Emits {SensorDataLogged}.
     */
    function logSensorData(
        uint256 _batchId,
        int256  _temperature,
        uint256 _humidity
    )
        external
        batchExists(_batchId)
    {
        // ── Checks ──────────────────────────────────────────────────────────
        if (_humidity > 100) revert InvalidHumidity(_humidity);

        // ── Effects ─────────────────────────────────────────────────────────
        CoffeeBatch storage batch = batches[_batchId];
        batch.temperatures.push(_temperature);
        batch.humidities.push(_humidity);
        batch.timestamps.push(block.timestamp);

        emit SensorDataLogged(_batchId, _temperature, _humidity);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm C – Transfer Custody (QR Checkpoint)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Transfers ownership of a batch to the caller's address.
     *
     * @dev    Designed to be triggered when a distributor or roaster scans the
     *         QR code on a coffee bag. Two invariants are enforced:
     *           1. The batch must exist.
     *           2. The caller must not already be the current owner.
     *
     *         The previous owner's address is cached into a stack variable
     *         BEFORE the state is mutated (CEI pattern) so the event always
     *         carries accurate `oldOwner` data.
     *
     * @param  _batchId  The batch being handed over (must already exist).
     *
     * Emits {CustodyTransferred}.
     */
    function transferCustody(uint256 _batchId)
        external
        batchExists(_batchId)
    {
        CoffeeBatch storage batch = batches[_batchId];

        // ── Checks ──────────────────────────────────────────────────────────
        if (batch.currentOwner == msg.sender) {
            revert AlreadyOwner(_batchId, msg.sender);
        }

        // ── Effects ─────────────────────────────────────────────────────────
        address previousOwner  = batch.currentOwner;   // cache before mutation
        batch.currentOwner     = msg.sender;
        batch.custodyTrail.push(msg.sender);

        emit CustodyTransferred(_batchId, previousOwner, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm D – Fetch Traceability Data (Consumer / Frontend View)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the scalar fields of a batch.
     *
     * @dev    Dynamic arrays are NOT returned here; use the dedicated helpers
     *         below. Returning multiple dynamic arrays in a single call can hit
     *         JSON-RPC payload limits for large datasets, so the separation is
     *         intentional.
     *
     * @param  _batchId      Target batch (must exist).
     * @return batchId_      The batch's own ID.
     * @return origin_       Farm / region of origin string.
     * @return currentOwner_ Wallet address of the current custodian.
     * @return readingCount  Number of sensor readings logged so far.
     * @return custodyCount  Total custody entries (origination + all transfers).
     */
    function getBatch(uint256 _batchId)
        external
        view
        batchExists(_batchId)
        returns (
            uint256 batchId_,
            string  memory origin_,
            address currentOwner_,
            uint256 readingCount,
            uint256 custodyCount
        )
    {
        CoffeeBatch storage batch = batches[_batchId];
        batchId_      = batch.batchId;
        origin_       = batch.origin;
        currentOwner_ = batch.currentOwner;
        readingCount  = batch.timestamps.length;
        custodyCount  = batch.custodyTrail.length;
    }

    /**
     * @notice Returns the complete, ordered custody trail for a batch.
     *
     * @dev    Index 0 is always the farmer who created the batch;
     *         the last element is always the current owner.
     *
     * @param  _batchId  Target batch (must exist).
     * @return trail     Memory copy of the custody-trail address array.
     */
    function getCustodyTrail(uint256 _batchId)
        external
        view
        batchExists(_batchId)
        returns (address[] memory trail)
    {
        trail = batches[_batchId].custodyTrail;
    }

    /**
     * @notice Returns all sensor readings for a batch as three parallel arrays.
     *
     * @dev    Element i across all three arrays describes a single reading event.
     *
     * @param  _batchId     Target batch (must exist).
     * @return temps_       Temperatures (int256, tenths of a degree).
     * @return humidities_  Humidity percentages (uint256, 0-100).
     * @return timestamps_  UNIX timestamps (uint256, seconds since epoch).
     */
    function getSensorData(uint256 _batchId)
        external
        view
        batchExists(_batchId)
        returns (
            int256[]  memory temps_,
            uint256[] memory humidities_,
            uint256[] memory timestamps_
        )
    {
        CoffeeBatch storage batch = batches[_batchId];
        temps_       = batch.temperatures;
        humidities_  = batch.humidities;
        timestamps_  = batch.timestamps;
    }

    /**
     * @notice Lightweight existence check — useful for frontends that want to
     *         validate a scanned QR code before making heavier view calls.
     *
     * @param  _batchId  Any integer to test.
     * @return exists    True if the batch has been created; false otherwise.
     */
    function batchExistsView(uint256 _batchId)
        external
        view
        returns (bool exists)
    {
        exists = (_batchId > 0 && _batchId <= batchCounter);
    }
}