// Temporary shim to avoid "module not found" while we refactor.
// Replace with the real Swiss Ephemeris adapter when ready.
module.exports = {
  getChartData: async (_args) => ({ planets: [], houses: [], meta: { shim: true } }),
};
