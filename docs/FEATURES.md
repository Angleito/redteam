# Feature Engineering Documentation

This document describes all features generated by the Sei AI Portfolio Data Collection system for machine learning model training.

## Table of Contents

1. [Price-Based Features](#price-based-features)
2. [Technical Indicators](#technical-indicators)
3. [Volatility Metrics](#volatility-metrics)
4. [Volume Analytics](#volume-analytics)
5. [On-Chain Metrics](#on-chain-metrics)
6. [DeFi Protocol Features](#defi-protocol-features)
7. [Market Microstructure](#market-microstructure)
8. [Cross-Asset Features](#cross-asset-features)
9. [Custom Features](#custom-features)

## Price-Based Features

### Returns

**Simple Returns**
- **Name**: `{asset}_returns`
- **Formula**: `(price[t] - price[t-1]) / price[t-1]`
- **Description**: Percentage change in price over one period
- **Range**: Typically -0.5 to 0.5 (extreme moves possible)
- **Use Case**: Momentum signals, trend following

**Log Returns**
- **Name**: `{asset}_log_returns`
- **Formula**: `ln(price[t] / price[t-1])`
- **Description**: Natural logarithm of price ratio
- **Range**: Unbounded, typically -0.3 to 0.3
- **Use Case**: Better statistical properties for modeling

**Multi-Period Returns**
- **Names**: `{asset}_returns_5m`, `{asset}_returns_15m`, `{asset}_returns_1h`
- **Description**: Returns over different time horizons
- **Use Case**: Multi-timeframe analysis

### Price Ratios

**Price Relative to Moving Average**
- **Name**: `{asset}_price_to_ma_{period}`
- **Formula**: `price / SMA(price, period)`
- **Description**: Current price relative to its moving average
- **Range**: Typically 0.8 to 1.2
- **Use Case**: Mean reversion strategies

## Technical Indicators

### RSI (Relative Strength Index)

- **Name**: `{asset}_rsi_{period}`
- **Default Period**: 14
- **Formula**: `100 - (100 / (1 + RS))` where RS = average gain / average loss
- **Range**: 0 to 100
- **Interpretation**:
  - \> 70: Overbought
  - < 30: Oversold
  - 50: Neutral
- **Use Case**: Momentum reversal signals

### MACD (Moving Average Convergence Divergence)

**MACD Line**
- **Name**: `{asset}_macd`
- **Formula**: `EMA(12) - EMA(26)`
- **Description**: Difference between fast and slow EMAs

**Signal Line**
- **Name**: `{asset}_macd_signal`
- **Formula**: `EMA(MACD, 9)`
- **Description**: Smoothed MACD line

**MACD Histogram**
- **Name**: `{asset}_macd_histogram`
- **Formula**: `MACD - Signal`
- **Use Case**: Trend strength and reversals

### Bollinger Bands

**Upper Band**
- **Name**: `{asset}_bb_upper`
- **Formula**: `SMA + (2 * σ)`
- **Description**: Upper volatility band

**Middle Band**
- **Name**: `{asset}_bb_middle`
- **Formula**: `SMA(price, 20)`
- **Description**: Simple moving average

**Lower Band**
- **Name**: `{asset}_bb_lower`
- **Formula**: `SMA - (2 * σ)`
- **Description**: Lower volatility band

**Band Width**
- **Name**: `{asset}_bb_width`
- **Formula**: `(Upper - Lower) / Middle`
- **Use Case**: Volatility breakout signals

## Volatility Metrics

### Historical Volatility

**Standard Deviation**
- **Name**: `{asset}_volatility_{period}`
- **Formula**: `σ(returns, period)`
- **Description**: Standard deviation of returns
- **Periods**: 5, 10, 20, 30
- **Use Case**: Risk measurement

**Realized Volatility**
- **Name**: `{asset}_realized_vol`
- **Formula**: `sqrt(sum(r²) * periods_per_year)`
- **Description**: Annualized realized volatility
- **Range**: 0 to 2+ (0% to 200%+)

### Advanced Volatility

**Parkinson Volatility**
- **Name**: `{asset}_parkinson_vol`
- **Formula**: Uses high-low range
- **Description**: More efficient volatility estimator
- **Use Case**: Better for low-frequency data

**GARCH Volatility**
- **Name**: `{asset}_garch_vol`
- **Description**: Conditional volatility from GARCH model
- **Use Case**: Volatility forecasting

## Volume Analytics

### Volume Metrics

**Volume Ratio**
- **Name**: `{asset}_volume_ratio`
- **Formula**: `volume / SMA(volume, 20)`
- **Description**: Current volume vs average
- **Range**: 0 to 5+
- **Use Case**: Unusual activity detection

**Volume-Weighted Average Price (VWAP)**
- **Name**: `{asset}_vwap`
- **Formula**: `sum(price * volume) / sum(volume)`
- **Description**: Average price weighted by volume
- **Use Case**: Institutional trading benchmarks

**On-Balance Volume (OBV)**
- **Name**: `{asset}_obv`
- **Description**: Cumulative volume flow indicator
- **Use Case**: Trend confirmation

### Money Flow

**Money Flow Index (MFI)**
- **Name**: `{asset}_mfi`
- **Formula**: Volume-weighted RSI
- **Range**: 0 to 100
- **Use Case**: Overbought/oversold with volume

## On-Chain Metrics

### Network Activity

**Transaction Count**
- **Name**: `sei_tx_count_{period}`
- **Description**: Number of transactions per period
- **Use Case**: Network usage indicator

**Active Addresses**
- **Name**: `sei_active_addresses_{period}`
- **Description**: Unique addresses transacting
- **Use Case**: Network adoption metric

**Gas Usage**
- **Name**: `sei_gas_usage_rate`
- **Formula**: `gas_used / gas_limit`
- **Range**: 0 to 1
- **Use Case**: Network congestion

### Economic Metrics

**Average Transaction Value**
- **Name**: `sei_avg_tx_value`
- **Description**: Mean transaction size in SEI
- **Use Case**: Economic activity indicator

**Gas Price Percentiles**
- **Names**: `sei_gas_p50`, `sei_gas_p90`, `sei_gas_p99`
- **Description**: Gas price distribution
- **Use Case**: Transaction cost estimation

## DeFi Protocol Features

### Liquidity Metrics

**Total Value Locked (TVL)**
- **Name**: `{protocol}_tvl`
- **Description**: Total USD value locked in protocol
- **Use Case**: Protocol health indicator

**TVL Change Rate**
- **Name**: `{protocol}_tvl_change_{period}`
- **Formula**: `(TVL[t] - TVL[t-period]) / TVL[t-period]`
- **Use Case**: Capital flow tracking

### Yield Metrics

**Average APY**
- **Name**: `{protocol}_avg_apy`
- **Description**: Average yield across pools
- **Range**: 0 to 1+ (0% to 100%+)
- **Use Case**: Yield optimization

**Utilization Rate**
- **Name**: `{protocol}_utilization`
- **Formula**: `borrowed / supplied`
- **Range**: 0 to 1
- **Use Case**: Lending protocol efficiency

## Market Microstructure

### Liquidity Depth

**Bid-Ask Spread**
- **Name**: `{asset}_spread`
- **Formula**: `(ask - bid) / mid`
- **Description**: Relative spread
- **Use Case**: Liquidity cost

**Order Book Imbalance**
- **Name**: `{asset}_order_imbalance`
- **Formula**: `(bid_volume - ask_volume) / (bid_volume + ask_volume)`
- **Range**: -1 to 1
- **Use Case**: Short-term price pressure

### Market Quality

**Price Impact**
- **Name**: `{asset}_price_impact_{size}`
- **Description**: Expected slippage for given size
- **Use Case**: Execution cost estimation

## Cross-Asset Features

### Correlations

**Rolling Correlation**
- **Name**: `{asset1}_{asset2}_corr_{period}`
- **Formula**: Pearson correlation over period
- **Range**: -1 to 1
- **Use Case**: Diversification signals

**Beta**
- **Name**: `{asset}_beta_vs_{market}`
- **Formula**: `cov(asset, market) / var(market)`
- **Description**: Systematic risk exposure
- **Use Case**: Risk management

### Relative Value

**Z-Score**
- **Name**: `{asset}_zscore_{period}`
- **Formula**: `(price - mean) / std`
- **Description**: Standardized price deviation
- **Use Case**: Mean reversion signals

**Pair Ratio**
- **Name**: `{asset1}_{asset2}_ratio`
- **Formula**: `price1 / price2`
- **Use Case**: Pairs trading

## Custom Features

### Composite Indicators

**Trend Strength Index**
- **Name**: `{asset}_trend_strength`
- **Formula**: Weighted combination of:
  - ADX (Average Directional Index)
  - MACD histogram
  - Price vs moving averages
- **Range**: -1 to 1
- **Use Case**: Unified trend signal

**Market Regime**
- **Name**: `market_regime`
- **Values**: 
  - 0: Bear market
  - 1: Neutral/ranging
  - 2: Bull market
- **Description**: Classified market state
- **Use Case**: Strategy selection

### Risk Indicators

**Drawdown**
- **Name**: `{asset}_drawdown`
- **Formula**: `(price - peak) / peak`
- **Range**: -1 to 0
- **Use Case**: Risk monitoring

**Value at Risk (VaR)**
- **Name**: `{asset}_var_{confidence}`
- **Description**: Maximum expected loss at confidence level
- **Use Case**: Risk limits

## Feature Selection Guidelines

### Correlation Analysis
- Remove features with correlation > 0.95
- Keep diverse feature types
- Balance technical and fundamental features

### Importance Ranking
1. **High Impact**: Returns, volatility, volume
2. **Medium Impact**: Technical indicators, correlations
3. **Low Impact**: Complex derivatives

### Timeframe Considerations
- **High Frequency** (< 5min): Microstructure features
- **Medium Frequency** (5min - 1h): Technical indicators
- **Low Frequency** (> 1h): Fundamental metrics

## Feature Normalization

All features are normalized using:

1. **Z-Score Normalization**
   - Formula: `(x - μ) / σ`
   - For unbounded features

2. **Min-Max Scaling**
   - Formula: `(x - min) / (max - min)`
   - For bounded features (RSI, correlations)

3. **Robust Scaling**
   - Using median and IQR
   - For features with outliers

## Usage in ML Models

### Feature Groups for Different Models

**Momentum Models**
- Returns (multiple periods)
- RSI, MACD
- Volume ratios
- Trend strength

**Mean Reversion Models**
- Z-scores
- Bollinger Bands
- Price to MA ratios
- RSI extremes

**Risk Models**
- Volatility metrics
- Correlations
- VaR, drawdown
- Beta

**Portfolio Optimization**
- All features combined
- Cross-asset correlations
- Risk-adjusted returns
- Market regime