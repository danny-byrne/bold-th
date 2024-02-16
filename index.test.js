const SLCSPPricer = require("./index.js");
const path = require("path");
const fs = require("fs");

describe("SLCSPPricer", () => {
  const slcspFilePath = path.join(__dirname, "assets", "slcsp.csv");
  const plansFilePath = path.join(__dirname, "assets", "plans.csv");
  const zipsFilePath = path.join(__dirname, "assets", "zips.csv");
  const outputFilePath = path.join(__dirname, "assets", "output.csv");

  let slcspPricer;

  beforeEach(() => {
    slcspPricer = new SLCSPPricer(
      slcspFilePath,
      plansFilePath,
      zipsFilePath,
      outputFilePath
    );
  });

  describe("readCSV", () => {
    it("should read CSV files and populate data arrays", async () => {
      await slcspPricer.readCSV();

      expect(slcspPricer.slcspRows.length).toBeGreaterThan(0);
      expect(slcspPricer.plansRows.length).toBeGreaterThan(0);
      expect(slcspPricer.zipsRows.length).toBeGreaterThan(0);
      expect(Object.keys(slcspPricer.zipsToRateAreas).length).toBeGreaterThan(
        0
      );
    });
  });

  describe("processZipToRate", () => {
    it("should process zip to rate area mapping amd print nothing for zips with multiple rate areas", () => {
      slcspPricer.zipsRows = [
        ["zipcode", "state", "", "", "rateArea"],
        ["12345", "NY", "", "", "1"],
        ["23456", "CA", "", "", "2"],
        ["34567", "TX", "", "", "3"],
        ["12345", "NY", "", "", "1"],
        ["23456", "CA", "", "", "3"],
        ["45678", "WA", "", "", "4"],
      ];

      slcspPricer.processZipToRate();

      expect(slcspPricer.zipsToRateAreas["12345"]).toEqual("NY 1");
      expect(slcspPricer.zipsToRateAreas["23456"]).toEqual("duplicate");
      expect(slcspPricer.zipsToRateAreas["34567"]).toEqual("TX 3");
      expect(slcspPricer.zipsToRateAreas["45678"]).toEqual("WA 4");
    });
  });

  describe("processSlcspRows", () => {
    it("should process SLCSP rows and write to output file", () => {
      slcspPricer.slcspRows = [
        ["zipcode"],
        ["12345"],
        ["23456"],
        ["34567"],
        ["45678"],
      ];

      slcspPricer.zipsToRateAreas = {
        12345: "NY 1",
        23456: "CA 2",
        34567: "TX 3",
        45678: "WA 4",
      };

      slcspPricer.plansRows = [
        ["plan_id", "state", "metal_level", "rate", "rate_area"],
        ["1", "NY", "Silver", "100", "1"],
        ["2", "NY", "Silver", "150", "1"],
        ["3", "CA", "Silver", "120", "2"],
        ["4", "CA", "Silver", "130", "2"],
        ["5", "TX", "Silver", "110", "3"],
        ["6", "TX", "Silver", "140", "3"],
        ["7", "WA", "Silver", "105", "4"],
        ["8", "WA", "Silver", "125", "4"],
      ];

      slcspPricer.processSlcspRows();

      const outputFileContents = fs.readFileSync(outputFilePath, "utf-8");
      const lines = outputFileContents.trim().split("\n");

      expect(lines.length).toBe(5); // Header + 4 data lines

      // Check if data lines are correctly written
      expect(lines[1]).toEqual("12345,150.00");
      expect(lines[2]).toEqual("23456,130.00");
      expect(lines[3]).toEqual("34567,140.00");
      expect(lines[4]).toEqual("45678,125.00");
    });
  });

  describe("findSecondLowestSilverPlanRate", () => {
    it("should return the second lowest silver plan rate for a given rate area", () => {
      slcspPricer.plansRows = [
        ["plan_id", "state", "metal_level", "rate", "rate_area"],
        ["1", "NY", "Silver", "100", "1"],
        ["2", "NY", "Silver", "150", "1"],
        ["3", "CA", "Silver", "120", "2"],
        ["4", "CA", "Silver", "130", "2"],
        ["5", "TX", "Silver", "110", "3"],
        ["6", "TX", "Silver", "140", "3"],
        ["7", "WA", "Silver", "105", "4"],
        ["8", "WA", "Silver", "125", "4"],
      ];

      const rateArea = "CA 2";
      const secondLowestRate =
        slcspPricer.findSecondLowestSilverPlanRate(rateArea);

      expect(secondLowestRate).toEqual(130);
    });
  });
});
