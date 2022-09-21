require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ganache");
owner = 'e2faa118c4605fceb2ec1067d345ca93492ed8c280e32dff41ca44a5e7acb361';
user1 = 'f4faa3fa3e5a793ce6a968016208d5b123c54501af08d170dc6bbe65949acc61';

// owner = '1134bdc770ccd3206f189edc816e5feb401c839675a321e5eb1a5efe6dad7816';
// user1 = 'f4faa3fa3e5a793ce6a968016208d5b123c54501af08d170dc6bbe65949acc61';

module.exports = {
    networks: {
        hardhat: {
            // chainId:250,
            // forking:{ 
            //     enabled:true,
            //     url: 'https://rpc.ftm.tools/',
            //     blockNumber:35620603
            // }
        },
        ropsten: {
            url: "https://ropsten.infura.io/v3/c45d6179097e4c59bee93eb0b395b35d",
            chainId: 3,
            accounts: [owner, user1]
        },
        fantomTest: {
            url: "https://rpc.testnet.fantom.network/",
            chainId: 4002,
            accounts: [owner, user1],
            gasMultiplier: 1,
            timeout: 20000
        },
        fantomMain: {
            url: "https://speedy-nodes-nyc.moralis.io/df82259c3cddffcc96cd43dd/fantom/mainnet",
            chainId: 250,
            accounts: [owner, user1],
            gasMultiplier: 2,
            timeout: 20000
        },
        fantom: {
            url: "https://rpc.ftm.tools",
            chainId: 250,
            accounts: [owner, user1],
            gasMultiplier: 1,
            timeout: 20000
        }
    },
    solidity: {
        compilers: [{
            version: "0.5.0",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }, {
            version: "0.6.12",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }, {
            version: "0.8.7",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }]
    },
    etherscan: {
        //apiKey: "3EBCSRPNAX3BNVPMWSG8F1XEHA9ANI3M5E"
        apiKey: "SMKS2QB6DJJJQWWJ5HGAVRZNB6YURY7PWF"
    }
}