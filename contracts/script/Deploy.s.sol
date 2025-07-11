// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/DataLogger.sol";
import "../src/OracleAggregator.sol";
import "../src/PortfolioVault.sol";
import "../src/LendingAdapter.sol";
import "../src/AIExecutor.sol";

/**
 * @title Deploy
 * @dev Deployment script for Sei blockchain data logging and portfolio management system
 * @notice Optimized deployment for Sei's fast block times and parallel execution
 */
contract Deploy is Script {
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Sei testnet chain ID
    uint256 constant SEI_TESTNET_CHAIN_ID = 713715;
    
    /// @dev Sei mainnet chain ID
    uint256 constant SEI_MAINNET_CHAIN_ID = 1329;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    DataLogger public dataLogger;
    OracleAggregator public oracleAggregator;
    PortfolioVault public portfolioVault;
    LendingAdapter public lendingAdapter;
    AIExecutor public aiExecutor;

    /*//////////////////////////////////////////////////////////////
                            DEPLOYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Main deployment function
     */
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying contracts to Sei blockchain...");
        console.log("Deployer address:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy contracts
        _deployContracts(deployer);

        // Verify deployment
        _verifyDeployment();

        // Setup initial configuration
        _setupInitialConfiguration();

        vm.stopBroadcast();

        // Log deployment info
        _logDeploymentInfo(deployer);
    }

    /**
     * @dev Deploy the main contracts
     * @param deployer The deployer address
     */
    function _deployContracts(address deployer) internal {
        // Initial authorized loggers (can be empty for now)
        address[] memory initialLoggers = new address[](1);
        initialLoggers[0] = deployer;

        // Deploy DataLogger
        console.log("Deploying DataLogger...");
        dataLogger = new DataLogger(deployer, initialLoggers);
        console.log("DataLogger deployed at:", address(dataLogger));

        // Deploy OracleAggregator
        console.log("Deploying OracleAggregator...");
        oracleAggregator = new OracleAggregator(deployer, address(dataLogger));
        console.log("OracleAggregator deployed at:", address(oracleAggregator));

        // Use mock addresses for base currency and AI signer (for testing)
        address baseCurrency = _createMockAsset("USDC");
        address aiSigner = vm.envOr("AI_SIGNER", deployer);

        // Deploy PortfolioVault
        console.log("Deploying PortfolioVault...");
        portfolioVault = new PortfolioVault(
            deployer,
            aiSigner,
            baseCurrency,
            address(oracleAggregator)
        );
        console.log("PortfolioVault deployed at:", address(portfolioVault));

        // Deploy LendingAdapter
        console.log("Deploying LendingAdapter...");
        lendingAdapter = new LendingAdapter(deployer, address(portfolioVault));
        console.log("LendingAdapter deployed at:", address(lendingAdapter));

        // Deploy AIExecutor
        console.log("Deploying AIExecutor...");
        aiExecutor = new AIExecutor(
            deployer,
            aiSigner,
            address(portfolioVault),
            address(lendingAdapter)
        );
        console.log("AIExecutor deployed at:", address(aiExecutor));
    }

    /**
     * @dev Verify deployment was successful
     */
    function _verifyDeployment() internal view {
        // Verify DataLogger
        require(address(dataLogger) != address(0), "DataLogger deployment failed");
        require(dataLogger.owner() != address(0), "DataLogger owner not set");
        require(dataLogger.getTotalEventCount() == 0, "DataLogger should start with 0 events");

        // Verify OracleAggregator
        require(address(oracleAggregator) != address(0), "OracleAggregator deployment failed");
        require(oracleAggregator.owner() != address(0), "OracleAggregator owner not set");
        require(address(oracleAggregator.dataLogger()) == address(dataLogger), "OracleAggregator dataLogger not linked");

        // Verify PortfolioVault
        require(address(portfolioVault) != address(0), "PortfolioVault deployment failed");
        require(portfolioVault.owner() != address(0), "PortfolioVault owner not set");
        require(portfolioVault.aiExecutor() != address(0), "PortfolioVault AI executor not set");
        require(portfolioVault.totalShares() == 0, "PortfolioVault should start with 0 shares");

        // Verify LendingAdapter
        require(address(lendingAdapter) != address(0), "LendingAdapter deployment failed");
        require(lendingAdapter.owner() != address(0), "LendingAdapter owner not set");
        require(lendingAdapter.portfolioVault() == address(portfolioVault), "LendingAdapter vault not linked");

        // Verify AIExecutor
        require(address(aiExecutor) != address(0), "AIExecutor deployment failed");
        require(aiExecutor.owner() != address(0), "AIExecutor owner not set");
        require(aiExecutor.portfolioVault() == address(portfolioVault), "AIExecutor vault not linked");
        require(aiExecutor.lendingAdapter() == address(lendingAdapter), "AIExecutor adapter not linked");

        console.log("✅ All contracts deployed and verified successfully");
    }

    /**
     * @dev Setup initial configuration
     */
    function _setupInitialConfiguration() internal {
        console.log("Setting up initial configuration...");

        // Authorize OracleAggregator to log data
        dataLogger.setLoggerAuthorization(address(oracleAggregator), true);
        console.log("✅ OracleAggregator authorized as logger");

        // Set AIExecutor as the AI agent in PortfolioVault
        portfolioVault.setAIAgent(address(aiExecutor));
        console.log("✅ AIExecutor set as AI agent for PortfolioVault");

        // Add some default supported assets
        address seiToken = _createMockAsset("SEI");
        address wethToken = _createMockAsset("WETH");
        portfolioVault.addSupportedAsset(seiToken);
        portfolioVault.addSupportedAsset(wethToken);
        console.log("✅ Added SEI and WETH as supported assets");

        // Setup sample oracle for testing (if on testnet)
        if (block.chainid == SEI_TESTNET_CHAIN_ID) {
            _setupTestnetConfiguration();
        }
    }

    /**
     * @dev Setup testnet-specific configuration
     */
    function _setupTestnetConfiguration() internal {
        console.log("Setting up testnet configuration...");

        // Create sample assets for testing
        address seiToken = _createMockAsset("SEI");
        address usdcToken = _createMockAsset("USDC");

        // Authorize deployer as oracle for testing
        oracleAggregator.setOracleAuthorization(msg.sender, seiToken, true);
        oracleAggregator.setOracleAuthorization(msg.sender, usdcToken, true);

        // Add mock lending protocols
        address mockAavePool = _createMockAsset("AAVE_POOL");
        address mockYeiPool = _createMockAsset("YEI_POOL");
        
        lendingAdapter.addProtocol(1, mockAavePool, address(0), "Aave V3");
        lendingAdapter.addProtocol(2, mockYeiPool, address(0), "Yei Finance");

        // Add mock DEX routers
        address mockDragonswap = _createMockAsset("DRAGONSWAP");
        portfolioVault.setAllowedDEX(mockDragonswap, true);

        console.log("✅ Testnet configuration complete");
        console.log("Sample SEI token:", seiToken);
        console.log("Sample USDC token:", usdcToken);
        console.log("Mock Aave pool:", mockAavePool);
        console.log("Mock Yei pool:", mockYeiPool);
        console.log("Mock DEX router:", mockDragonswap);
    }

    /**
     * @dev Create a mock asset address for testing
     * @param symbol The asset symbol
     * @return The mock asset address
     */
    function _createMockAsset(string memory symbol) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(symbol)))));
    }

    /**
     * @dev Log deployment information
     * @param deployer The deployer address
     */
    function _logDeploymentInfo(address deployer) internal view {
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network:", _getNetworkName());
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Block Number:", block.number);
        console.log("Timestamp:", block.timestamp);
        
        console.log("\n=== DEPLOYED CONTRACTS ===");
        console.log("DataLogger:", address(dataLogger));
        console.log("OracleAggregator:", address(oracleAggregator));
        console.log("PortfolioVault:", address(portfolioVault));
        console.log("LendingAdapter:", address(lendingAdapter));
        console.log("AIExecutor:", address(aiExecutor));
        
        console.log("\n=== CONTRACT INFO ===");
        console.log("DataLogger Owner:", dataLogger.owner());
        console.log("DataLogger Authorized Loggers: 2 (owner + OracleAggregator)");
        console.log("OracleAggregator Owner:", oracleAggregator.owner());
        console.log("OracleAggregator DataLogger:", address(oracleAggregator.dataLogger()));
        console.log("PortfolioVault Owner:", portfolioVault.owner());
        console.log("PortfolioVault AI Executor:", portfolioVault.aiExecutor());
        console.log("LendingAdapter Owner:", lendingAdapter.owner());
        console.log("AIExecutor Owner:", aiExecutor.owner());
        console.log("AIExecutor AI Signer:", aiExecutor.aiSigner());
        
        console.log("\n=== OPTIMIZATION NOTES ===");
        console.log("✅ Contracts optimized for Sei's 400ms block times");
        console.log("✅ Minimal storage, maximum events for data collection");
        console.log("✅ Batch operations supported for gas efficiency");
        console.log("✅ Parallel execution compatible");
        
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Authorize additional oracles using setOracleAuthorization()");
        console.log("2. Authorize additional loggers using setLoggerAuthorization()");
        console.log("3. Begin logging portfolio actions and market data");
        console.log("4. Monitor events for AI training data collection");
        console.log("5. Fund the PortfolioVault with initial assets");
        console.log("6. Configure AI agent signatures for automated operations");
        console.log("7. Set up lending protocol integrations");
        console.log("8. Configure DEX routers for trading");
    }

    /**
     * @dev Get network name based on chain ID
     * @return The network name
     */
    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == SEI_MAINNET_CHAIN_ID) {
            return "Sei Mainnet";
        } else if (block.chainid == SEI_TESTNET_CHAIN_ID) {
            return "Sei Testnet";
        } else {
            return "Unknown Network";
        }
    }

    /*//////////////////////////////////////////////////////////////
                            UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Deploy with custom parameters
     * @param owner The contract owner
     * @param initialLoggers Array of initial authorized loggers
     */
    function deployWithParams(address owner, address[] memory initialLoggers) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        dataLogger = new DataLogger(owner, initialLoggers);
        oracleAggregator = new OracleAggregator(owner, address(dataLogger));

        vm.stopBroadcast();

        console.log("Custom deployment complete:");
        console.log("DataLogger:", address(dataLogger));
        console.log("OracleAggregator:", address(oracleAggregator));
    }

    /**
     * @dev Upgrade contracts (for proxy patterns)
     * @param newDataLoggerImpl New DataLogger implementation
     * @param newOracleAggregatorImpl New OracleAggregator implementation
     */
    function upgradeContracts(
        address newDataLoggerImpl,
        address newOracleAggregatorImpl
    ) external {
        console.log("Upgrade functionality for proxy patterns");
        console.log("New DataLogger implementation:", newDataLoggerImpl);
        console.log("New OracleAggregator implementation:", newOracleAggregatorImpl);
        
        // Implementation would depend on proxy pattern used
        // This is a placeholder for future upgrade functionality
    }
}