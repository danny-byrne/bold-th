const fs = require("fs");
const csv = require("csv-parse");
const path = require("node:path");

const { parse } = csv;

class SLCSPPricer {
  constructor(slcspFilePath, plansFilePath, zipsFilePath, outputFilePath) {
    this.slcspFilePath = slcspFilePath;
    this.plansFilePath = plansFilePath;
    this.zipsFilePath = zipsFilePath;
    this.outputFilePath = outputFilePath;
    this.slcspRows = [];
    this.plansRows = [];
    this.zipsRows = [];
    this.zipsToRateAreas = {};
  }

  async readCSV() {
    await this.readZipCSV();
    await this.readPlansCSV();
    await this.readSlcspCSV();
  }

  async readZipCSV() {
    await new Promise((resolve, reject) => {
      fs.createReadStream(this.zipsFilePath)
        .pipe(parse({ delimiter: "," }))
        .on("data", (row) => {
          this.zipsRows.push(row);
        })
        .on("end", () => {
          this.zipsToRateAreas = this.processZipToRate();
          resolve();
        });
    });
  }

  async readPlansCSV() {
    await new Promise((resolve, reject) => {
      fs.createReadStream(this.plansFilePath)
        .pipe(parse({ delimiter: "," }))
        .on("data", (row) => {
          this.plansRows.push(row);
        })
        .on("end", resolve);
    });
  }

  async readSlcspCSV() {
    await new Promise((resolve, reject) => {
      fs.createReadStream(this.slcspFilePath)
        .pipe(parse({ delimiter: "," }))
        .on("data", (row) => {
          this.slcspRows.push(row);
        })
        .on("end", () => {
          this.processSlcspRows();
          resolve();
        });
    });
  }

  processZipToRate() {
    const zipToRateArea = {};
    for (let i = 1; i < this.zipsRows.length; i++) {
      const [zip, state, , , rateArea] = this.zipsRows[i];
      const stateAndRate = `${state} ${rateArea}`;
      if (!zipToRateArea[zip]) {
        zipToRateArea[zip] = stateAndRate;
      } else if (
        zipToRateArea[zip] !== stateAndRate &&
        zipToRateArea[zip] !== "duplicate"
      ) {
        zipToRateArea[zip] = "duplicate";
      }
    }
    this.zipsToRateAreas = zipToRateArea; // Update the zipsToRateAreas property
    return zipToRateArea;
  }

  processSlcspRows() {
    const outputData = ["zipcode, rate"]; // Array to store output data
    for (let i = 1; i < this.slcspRows.length; i++) {
      const [zip] = this.slcspRows[i];
      const stateAndRateArea = this.zipsToRateAreas[zip];
      const slcspRate =
        stateAndRateArea === "duplicate"
          ? ""
          : this.findSecondLowestSilverPlanRate(stateAndRateArea);
      const outputLine = slcspRate
        ? `${zip},${slcspRate.toFixed(2)}`
        : `${zip},`;
      outputData.push(outputLine); // Add the output line to the array
    }
    fs.writeFileSync(this.outputFilePath, outputData.join("\n"));
  }

  findSecondLowestSilverPlanRate(stateAndRate) {
    const [rateState, rateArea] = stateAndRate.split(" ");
    const silverPlanRatesInArea = this.plansRows.reduce((uniqueRates, plan) => {
      const [, planState, metalLevel, rate, planRateArea] = plan;
      const isARateAreaMatch =
        metalLevel === "Silver" &&
        planRateArea === rateArea &&
        planState === rateState;
      if (isARateAreaMatch) {
        uniqueRates.add(rate);
      }
      return uniqueRates;
    }, new Set());

    const uniqueRatesArray = Array.from(silverPlanRatesInArea);
    if (uniqueRatesArray.length < 2) {
      return;
    }

    const sortedRates = uniqueRatesArray
      .map((rate) => parseFloat(rate))
      .sort((a, b) => a - b);

    return sortedRates[1];
  }
}

// Usage
const slcspPricer = new SLCSPPricer(
  path.join(__dirname, "assets", "slcsp.csv"),
  path.join(__dirname, "assets", "plans.csv"),
  path.join(__dirname, "assets", "zips.csv"),
  path.join(__dirname, "assets", "output.csv")
);

slcspPricer.readCSV();

module.exports = SLCSPPricer;
