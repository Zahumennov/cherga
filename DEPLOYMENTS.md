# Deployments

Testnet only. Nothing here is deployed to mainnet — see stage 7 in
[`docs/roadmap.md`](docs/roadmap.md) for when that changes.

---

## Whitechain Sepolia

OP Stack L2 testnet, settles on Ethereum Sepolia. Chain ID `1874`
(`0x752`). [Docs](https://l2docs.whitechain.io) ·
[Explorer](https://explorer.testnet.whitechain.io) ·
[Faucet](https://faucet.testnet.whitechain.io)

Deployed 2026-08-14, via `script/Deploy.s.sol`, solc `0.8.35`.

| Contract | Address | Explorer |
|---|---|---|
| `CircleFactory` | `0x7C6800d3fE6d21bcEfa8064a7920F4404408cBA9` | [verified](https://explorer.testnet.whitechain.io/address/0x7c6800d3fe6d21bcefa8064a7920f4404408cba9) |
| `MockERC20` ("mUSD") | `0xf52b97bedD10727B3DC0172AC8030AB4114de7f8` | [verified](https://explorer.testnet.whitechain.io/address/0xf52b97bedd10727b3dc0172ac8030ab4114de7f8) |

`MockERC20.mint(address, uint256)` is public — anyone can mint themselves
test tokens to try a circle. No real stablecoin exists yet on this
brand-new L2, so this stands in for one; it is **not** meant to hold value
and isn't used past testnet stages.

Deployment transactions:

- `MockERC20` create: [`0xc196ad8d…5cbb7f6`](https://explorer.testnet.whitechain.io/tx/0xc196ad8db89f38f4cb234343e19d7edf74d06d61351c939e1eeb2442b5cbb7f6)
- `CircleFactory` create: [`0xdc3695dc…9e214cbc`](https://explorer.testnet.whitechain.io/tx/0xdc3695dcee9fa8b3c7b7b78c3c4b8e44dd4628447f2c204cb35ce0169e214cbc)
- Initial `mint(deployer, 1_000_000e18)`: [`0x4b8537c7…0633caa`](https://explorer.testnet.whitechain.io/tx/0x4b8537c7ab83d0f8a588882468456ab5b7efca7ddd1f9e288782f5f8e0633caa)

---

## Second testnet (popular L2)

Not deployed yet — `docs/roadmap.md` stage 5 also calls for one popular L2
testnet alongside Whitechain. Separate step.
