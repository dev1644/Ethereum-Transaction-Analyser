const Web3 = require("web3");
const web3 = new Web3("http://node.web3api.com:8545");

const superagent = require("superagent");

const getTraceOfTransaction = txHash =>
  superagent
    .post("http://node.web3api.com:8545")
    .send({
      id: 2,
      method: "debug_traceTransaction",
      params: [txHash, { tracer: "callTracer" }]
    }) // sends a JSON post body
    .set("Content-Type", "application/json");

const fetchAllTransferFromTraces = (txTrace, txHash) => {
  let insAndOut = { ins: [], out: [] };

  if (txTrace === undefined) {
    return insAndOut;
  }

  txTrace.forEach(call => {
    insAndOut = fetchAllTransferFromTraces(call.calls, txHash);

    if (call.value && call.value !== "0x0") {
      const { from, to } = call;
      const value = web3.utils.hexToNumberString(call.value);

      insAndOut.ins.push({
        address: from,
        value: `-${value}`,
        type: "transfer",
        coinspecific: {
          tracehash: txHash
        }
      });
      insAndOut.out.push({
        address: to,
        value: value,
        type: "transfer",
        coinspecific: {
          tracehash: txHash
        }
      });
    }
    return insAndOut;
  });

  return insAndOut;
};

const getTransaction = async txHash => {
  let response = {
    block: {
      blockHeight: ""
    },
    outs: [],
    ins: [],
    hash: "",
    currency: "ETH",
    chain: "ETH.Main",
    state: "confirmed",
    depositType: ""
  };

  const txDetails = await web3.eth.getTransaction(txHash);

  if (response.blockNumber === null)
    throw new Error("Transaction is not confirmed");

  response["block"]["blockHeight"] = txDetails.blockNumber;
  response["hash"] = txDetails.hash;
  response["hash"] = txDetails.hash;

  const codesize = await web3.eth.getCode(txDetails.to);

  if (codesize !== "0x") {
    const txTrace = (await getTraceOfTransaction(txHash)).body.result;
    const txReciept = await web3.eth.getTransactionReceipt(txHash);

    txReciept.logs.forEach(log => {
      const { data, topics, address } = log;
      if (
        log.topics[0] ===
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ) {
        const from = `0x${topics[1].slice(27)}`;
        const to = `0x${topics[2].slice(27)}`;
        const value = web3.utils.hexToNumberString(data);

        response["ins"].push({
          address: from,
          value: `-${value}`,
          type: "token",
          coinSpecific: {
            tokenAddress: address
          }
        });
        response["outs"].push({
          address: to,
          value: value,
          type: "token",
          coinSpecific: {
            tokenAddress: address
          }
        });
      }
    });

    const insAndOut = fetchAllTransferFromTraces(txTrace.calls, txDetails.hash);
    if (insAndOut.ins.length > 0) {
      response.ins.push(insAndOut.ins);
      response.outs.push(insAndOut.out);
      response.depositType = "contract";
    } else response.depositType = "token";
  } else {
    response["depositType"] = "account";
    response["ins"].push({
      address: txDetails.from,
      value: `-${txDetails.value}`
    });
    response["outs"].push({
      address: txDetails.to,
      value: txDetails.value
    });
  }

  return response;
};

module.exports = getTransaction;
