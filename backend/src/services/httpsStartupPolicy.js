function shouldAbortOnHttpsFailure(nodeEnv) {
  return nodeEnv === "production";
}

module.exports = { shouldAbortOnHttpsFailure };