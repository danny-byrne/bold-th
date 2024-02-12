const fs = require("fs");
const csv = require("csv-parse");
const path = require("node:path");

const { parse } = csv;

// Construct the file paths to read CSV files
const slcspFilePath = path.join(__dirname, "assets", "slcsp.csv");
const plansFilePath = path.join(__dirname, "assets", "plans.csv");
const zipsFilePath = path.join(__dirname, "assets", "zips.csv");
const outputFilePath = path.join(__dirname, "assets", "output.csv"); // New output file path

// Read CSV files
let slcspRows = [];
let plansRows = [];
let zipsRows = [];
let zipsToRateAreas = {};

const readCSV = async () => {
  await new Promise((resolve, reject) => {
    fs.createReadStream(zipsFilePath)
      .pipe(parse({ delimiter: "," }))
      .on("data", (row) => {
        zipsRows.push(row);
      })
      .on("end", () => {
        zipsToRateAreas = processZipToRate();
        resolve();
      });
  });

  await new Promise((resolve, reject) => {
    fs.createReadStream(plansFilePath)
      .pipe(parse({ delimiter: "," }))
      .on("data", (row) => {
        plansRows.push(row);
      })
      .on("end", resolve);
  });

  await new Promise((resolve, reject) => {
    fs.createReadStream(slcspFilePath)
      .pipe(parse({ delimiter: "," }))
      .on("data", (row) => {
        slcspRows.push(row);
      })
      .on("end", () => {
        processSlcspRows();
        resolve();
      });
  });
};

readCSV();

const silver = "Silver",
  duplicate = "duplicate";

function processZipToRate() {
  const zipToRateArea = {};
  for (let i = 1; i < zipsRows.length; i++) {
    const [zip, state, , , rateArea] = zipsRows[i];
    const stateAndRate = `${state} ${rateArea}`;
    if (!zipToRateArea[zip]) {
      zipToRateArea[zip] = stateAndRate;
      //if a duplicate is found, set the value to duplicate
    } else if (zipToRateArea[zip] && stateAndRate !== zipToRateArea[zip]) {
      zipToRateArea[zip] = duplicate;
    }
  }

  return zipToRateArea;
}

function processSlcspRows() {
  const outputData = ["zipcode, rate"]; // Array to store output data
  for (let i = 1; i < slcspRows.length; i++) {
    const [zip] = slcspRows[i];
    const stateAndRateArea = zipsToRateAreas[zip];

    const slcspRate =
      stateAndRateArea === duplicate
        ? ""
        : findSecondLowestSilverPlanRate(plansRows, stateAndRateArea);
    const outputLine = slcspRate ? `${zip},${slcspRate.toFixed(2)}` : `${zip},`;
    outputData.push(outputLine); // Add the output line to the array
  }
  fs.writeFileSync(outputFilePath, outputData.join("\n"));
}

// Function to find the second lowest silver plan rate for a given rate area
function findSecondLowestSilverPlanRate(plans, stateAndRate) {
  const [rateState, rateArea] = stateAndRate.split(" ");
  //prevent duplicate rates being added by using a set
  const silverPlanRatesInArea = plans.reduce((uniqueRates, plan) => {
    const [, planState, metalLevel, rate, planRateArea] = plan;
    const isARateAreaMatch =
      metalLevel === silver &&
      planRateArea === rateArea &&
      planState === rateState;
    if (isARateAreaMatch) {
      uniqueRates.add(rate);
    }
    return uniqueRates;
  }, new Set());

  const uniqueRatesArray = Array.from(silverPlanRatesInArea);
  // Not enough silver plans to determine SLCSP
  if (uniqueRatesArray.length < 2) {
    return;
  }

  const sortedRates = uniqueRatesArray
    .map((rate) => parseFloat(rate))
    .sort((a, b) => a - b);

  return sortedRates[1];
}
