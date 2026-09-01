# Umbra staking

`UmbraStaking.sol` is an unaudited single-token staking contract for `$UMBRA`
on Robinhood Chain (chain ID `4663`). The token address is
`0x6df8e6434e93efac8c471b00a2e8ae1659ea3ed0` and the chain's gas token is ETH.

## Build and test

Install Foundry, then run from the repository root:

```bash
forge build
forge test -vv
```

## Deploy

Set the deployer key in Foundry's usual `PRIVATE_KEY` environment variable,
along with the token and owner addresses:

```bash
export UMBRA_TOKEN=0x6df8e6434e93efac8c471b00a2e8ae1659ea3ed0
export STAKING_OWNER=0xYourOwnerAddress
export PRIVATE_KEY=0xYourDeployerPrivateKey
forge script contracts/script/DeployUmbraStaking.s.sol:DeployUmbraStaking \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --chain-id 4663 \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

The deployer must have enough ETH for gas. The contract is unaudited; obtain an
independent security review before funding it.

## Fund a reward period

The owner must first transfer reward `$UMBRA` to the deployed staking contract,
then call `notifyRewardAmount(amount, duration)`. The amount uses 18-decimal
token units:

```bash
export STAKING=0xDeployedStakingAddress
cast send "$UMBRA_TOKEN" "transfer(address,uint256)" "$STAKING" \
  100000000000000000000 \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --private-key "$PRIVATE_KEY"
cast send "$STAKING" "notifyRewardAmount(uint256,uint256)" \
  100000000000000000000 2592000 \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --private-key "$PRIVATE_KEY"
```

Use the owner's signing key for both funding transactions. A reward period must
be fully accounted for before the owner can recover unallocated rewards.
