"use client";

import { useState } from "react";

export default function CreatePartyPage() {
  const [form, setForm] = useState({
    ledgerName: "",
    mailingName: "",
    address: "",
    station: "",
    pin: "",
    state: "",
    country: "India",
    email: "",
    website: "",
    contactPerson: "",
    designation: "",
    phoneOffice: "",
    phoneRes: "",
    mobile: "",
    fax: "",
    dl20: "",
    dl21: "",
    dlExpiry: "",
    foodLic: "",
    foodLicExpiry: "",
    gstin: "",
    pan: "",
    openingBalance: "",
    openingType: "Dr",
    ledgerDate: "",
    accountGroup: "Sundry Debtors",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    console.log("Party Saved:", form);

    alert("Party created successfully!");
  };

  return (
    <div className="p-6 text-gray-200">
      <h1 className="text-2xl font-semibold mb-4">Create Party / Ledger</h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-6 bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-lg"
      >
        {/* --------------- Left Column --------------- */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-300">Basic Details</h2>

          <Input
            label="Ledger Name"
            value={form.ledgerName}
            required
            onChange={(val: string) => handleChange("ledgerName", val)}
          />

          <Input
            label="Mailing Name"
            value={form.mailingName}
            onChange={(val: string) => handleChange("mailingName", val)}
          />

          <Input
            label="Address"
            textarea
            value={form.address}
            onChange={(val: string) => handleChange("address", val)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Station / City"
              value={form.station}
              onChange={(val: string) => handleChange("station", val)}
            />
            <Input
              label="Pin Code"
              value={form.pin}
              onChange={(val: string) => handleChange("pin", val)}
            />
          </div>

          <Input
            label="State"
            value={form.state}
            onChange={(val: string) => handleChange("state", val)}
          />

          <Input
            label="Country"
            value={form.country}
            onChange={(val: string) => handleChange("country", val)}
          />

          <Input
            label="Email"
            value={form.email}
            onChange={(val: string) => handleChange("email", val)}
          />

          <Input
            label="Website"
            value={form.website}
            onChange={(val: string) => handleChange("website", val)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              value={form.contactPerson}
              onChange={(val: string) => handleChange("contactPerson", val)}
            />
            <Input
              label="Designation"
              value={form.designation}
              onChange={(val: string) => handleChange("designation", val)}
            />
          </div>
        </div>

        {/* --------------- Right Column --------------- */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-300">Contact Details</h2>

          <Input
            label="Phone (Office)"
            value={form.phoneOffice}
            onChange={(val: string) => handleChange("phoneOffice", val)}
          />

          <Input
            label="Phone (Residence)"
            value={form.phoneRes}
            onChange={(val: string) => handleChange("phoneRes", val)}
          />

          <Input
            label="Mobile No."
            value={form.mobile}
            onChange={(val: string) => handleChange("mobile", val)}
          />

          <Input
            label="Fax No."
            value={form.fax}
            onChange={(val: string) => handleChange("fax", val)}
          />

          <h2 className="text-lg font-semibold text-gray-300 pt-4">
            Pharma License Details
          </h2>

          <Input
            label="Drug License No. 20B"
            value={form.dl20}
            onChange={(val: string) => handleChange("dl20", val)}
          />

          <Input
            label="Drug License No. 21B"
            value={form.dl21}
            onChange={(val: string) => handleChange("dl21", val)}
          />

          <Input
            label="DL Expiry Date"
            type="date"
            value={form.dlExpiry}
            onChange={(val: string) => handleChange("dlExpiry", val)}
          />

          <Input
            label="Food License No."
            value={form.foodLic}
            onChange={(val: string) => handleChange("foodLic", val)}
          />

          <Input
            label="Food License Expiry"
            type="date"
            value={form.foodLicExpiry}
            onChange={(val: string) => handleChange("foodLicExpiry", val)}
          />

          <Input
            label="GSTIN"
            value={form.gstin}
            onChange={(val: string) => handleChange("gstin", val)}
          />

          <Input
            label="PAN No."
            value={form.pan}
            onChange={(val: string) => handleChange("pan", val)}
          />

          <h2 className="text-lg font-semibold text-gray-300 pt-4">
            Accounting Info
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Opening Balance"
              value={form.openingBalance}
              onChange={(val: string) => handleChange("openingBalance", val)}
            />

            <Select
              label="Type"
              value={form.openingType}
              options={["Dr", "Cr"]}
              onChange={(val: string) => handleChange("openingType", val)}
            />
          </div>

          <Select
            label="Account Group"
            value={form.accountGroup}
            options={[
              "Sundry Debtors",
              "Sundry Creditors",
              "Supplier",
              "Customer",
              "Others",
            ]}
            onChange={(val: string) => handleChange("accountGroup", val)}
          />

          <Input
            label="Ledger Date"
            type="date"
            value={form.ledgerDate}
            onChange={(val: string) => handleChange("ledgerDate", val)}
          />
        </div>

        <div className="col-span-2 flex justify-end mt-4">
          <button
            type="submit"
            className="px-6 py-3 bg-green-500 hover:bg-green-600 font-semibold rounded-lg text-gray-900"
          >
            Save Party
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  textarea,
  type = "text",
}: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">{label}</label>

      {textarea ? (
        <textarea
          className="p-2 bg-[#0f172a] border border-gray-700 rounded-lg text-gray-100 focus:outline-none"
          value={value}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <input
          type={type}
          className="p-2 bg-[#0f172a] border border-gray-700 rounded-lg text-gray-100 focus:outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
    </div>
  );
}

/* ------------------- Select Component ------------------- */

function Select({ label, value, options, onChange }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">{label}</label>

      <select
        className="p-2 bg-[#0f172a] border border-gray-700 rounded-lg text-gray-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((op: string) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
    </div>
  );
}
