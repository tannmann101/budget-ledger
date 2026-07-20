import { useState, useMemo } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { useCloudLedger } from "./useCloudLedger";
import AuthGate, { useAuthUser, Centered } from "./AuthGate";
import Plan from "./Plan";
import Debts from "./Debts";
import { accrueDebt } from "./debtAccrual";
import { DEFAULT_ASSUMPTIONS } from "./simulationEngine";
import { buildReport } from "./report";
import { MONO, SANS, BG, PAGE, INK, MUTE, LINE, TEAL, BRICK, GOLD, RADIUS_SM } from "./theme";
import { GlobalStyle, Table, Th, Td, SectionTitle, Btn, Input, Select, TabBar, Card } from "./ui";
import { IconLedger, IconDebts, IconPlan } from "./icons";

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = (d = new Date()) => d.toISOString().slice(0, 7);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const DEFAULT_CATEGORIES = [
  { id: "cat-gas-groceries", name: "Gas/Groceries", limit: 700, chargeDebtId: "debt-my-cc" },
  { id: "cat-rent", name: "Rent" },
  { id: "cat-amazon", name: "Amazon" },
  { id: "cat-adjustment", name: "Adjustment" },
  { id: "cat-allowance", name: "Allowance" },
  { id: "cat-clothes", name: "Clothes" },
  { id: "cat-coffee", name: "Coffee" },
  { id: "cat-consolidation-loan", name: "Consolidation Loan" },
  { id: "cat-credit-card", name: "Credit Card" },
  { id: "cat-eating-out", name: "Eating Out" },
  { id: "cat-entertainment", name: "Entertainment" },
  { id: "cat-gifts", name: "Gifts" },
  { id: "cat-haircut", name: "Haircut" },
  { id: "cat-holidays", name: "Holidays" },
  { id: "cat-insurance", name: "Insurance" },
  { id: "cat-phone", name: "Phone" },
  { id: "cat-savings", name: "Savings" },
  { id: "cat-utilities", name: "Utilities" },
  { id: "cat-work-expense", name: "Work Expense" },
];

function buildSeedData() {
  const debts = [
    { id: "debt-wife-cc", name: "Rochelle's Credit Card", balance: 10292.67, rate: 16.15, minPayment: 350, creditLimit: null, lastUpdated: todayStr(), totalPaid: 0, totalCharged: 0 },
    { id: "debt-my-cc", name: "Tanner's Credit Card", balance: 5564.87, rate: 16.49, minPayment: 700, creditLimit: null, lastUpdated: todayStr(), totalPaid: 0, totalCharged: 0 },
    { id: "debt-consolidation", name: "Consolidation Loan", balance: 32208.90, rate: 11.49, minPayment: 700, creditLimit: null, lastUpdated: todayStr(), totalPaid: 0, totalCharged: 0 },
  ];
  const debtTotal = debts.reduce((s, d) => s + d.balance, 0);
  const checking = 1576.00;
  const savings = 9000.94;
  const income = [
    { id: "inc-0104", date: "2026-01-04", amount: 158.31, note: "" },
    { id: "inc-0111", date: "2026-01-11", amount: 86.79, note: "" },
    { id: "inc-0114", date: "2026-01-14", amount: 1523.31, note: "" },
    { id: "inc-0128", date: "2026-01-28", amount: 2372.33, note: "" },
    { id: "inc-0131", date: "2026-01-31", amount: 196.33, note: "" },
    { id: "inc-0211", date: "2026-02-11", amount: 1738.22, note: "" },
    { id: "inc-0215", date: "2026-02-15", amount: 152.33, note: "" },
    { id: "inc-0222", date: "2026-02-22", amount: 115.59, note: "" },
    { id: "inc-0225", date: "2026-02-25", amount: 1509.34, note: "" },
    { id: "inc-0311", date: "2026-03-11", amount: 1494.43, note: "" },
    { id: "inc-0314", date: "2026-03-14", amount: 130.00, note: "" },
    { id: "inc-0325", date: "2026-03-25", amount: 1614.30, note: "" },
    { id: "inc-0408", date: "2026-04-08", amount: 1617.90, note: "" },
    { id: "inc-0422", date: "2026-04-22", amount: 1870.65, note: "" },
    { id: "inc-0506", date: "2026-05-06", amount: 1683.75, note: "" },
    { id: "inc-0520", date: "2026-05-20", amount: 1821.68, note: "" },
    { id: "inc-0602", date: "2026-06-02", amount: 3730.18, note: "" },
  ];
  return {
    income,
    checking,
    savings,
    debts,
    bills: [
      { id: "bill-rent", name: "Rent", amount: 1025, day: "1st", status: "set", paidMonths: [] },
      { id: "bill-amazon", name: "Amazon", amount: 15, day: "12th", status: "set", paidMonths: [] },
      { id: "bill-rcc", name: "RCC", amount: 350, day: "15th", status: "set", paidMonths: [] },
      { id: "bill-insurance", name: "Insurance", amount: 124, day: "17th/29th", status: "set", paidMonths: [] },
      { id: "bill-phone", name: "Phone", amount: 128.40, day: "15th", status: "set", paidMonths: [] },
      { id: "bill-loan", name: "Consolidation Loan Payment", amount: 673.09, day: "24th", status: "set", paidMonths: [] },
      { id: "bill-internet", name: "Internet", amount: 0, day: "", status: "projected", paidMonths: [] },
      { id: "bill-utility", name: "Water/Sewer/Trash (2BR flat rate)", amount: 60, day: "", status: "projected", paidMonths: [] },
    ],
    categories: DEFAULT_CATEGORIES,
    expenses: [
      { id: "hist-lr2yzol", categoryId: "cat-allowance", amount: 250, month: "2026-06" },
      { id: "hist-n34cd9g", categoryId: "cat-eatingout", amount: 80, month: "2026-05" },
      { id: "hist-vmo4ytu", categoryId: "cat-eatingout", amount: 59.16, month: "2026-05" },
      { id: "hist-84ppzdi", categoryId: "cat-entertainment", amount: 57.62, month: "2026-05" },
      { id: "hist-gp87d1q", categoryId: "cat-entertainment", amount: 39.33, month: "2026-05" },
      { id: "hist-8gg0jku", categoryId: "cat-eatingout", amount: 35.91, month: "2026-05" },
      { id: "hist-1ayv4ms", categoryId: "cat-entertainment", amount: 68.85, month: "2026-05" },
      { id: "hist-klen0rn", categoryId: "cat-eatingout", amount: 29.34, month: "2026-05" },
      { id: "hist-mfpowkk", categoryId: "cat-entertainment", amount: 85.07, month: "2026-05" },
      { id: "hist-rnfqdj9", categoryId: "cat-allowance", amount: 65.56, month: "2026-05" },
      { id: "hist-ruznj6p", categoryId: "cat-entertainment", amount: 58.41, month: "2026-05" },
      { id: "hist-a7016lw", categoryId: "cat-allowance", amount: 10, month: "2026-04" },
      { id: "hist-p1zmudr", categoryId: "cat-eatingout", amount: 21.86, month: "2026-04" },
      { id: "hist-up3bvmx", categoryId: "cat-allowance", amount: 10, month: "2026-04" },
      { id: "hist-619g88x", categoryId: "cat-entertainment", amount: 38.22, month: "2026-04" },
      { id: "hist-bstsi0o", categoryId: "cat-eatingout", amount: 9.6, month: "2026-04" },
      { id: "hist-lbwlpz9", categoryId: "cat-fuel", amount: 30, month: "2026-04" },
      { id: "hist-l7ie2dq", categoryId: "cat-allowance", amount: 200, month: "2026-04" },
      { id: "hist-ultl9nv", categoryId: "cat-coffee", amount: 6.26, month: "2026-04" },
      { id: "hist-p7j3dv7", categoryId: "cat-eatingout", amount: 15.63, month: "2026-04" },
      { id: "hist-icgyihk", categoryId: "cat-eatingout", amount: 29.5, month: "2026-04" },
      { id: "hist-10k74v8", categoryId: "cat-coffee", amount: 10.72, month: "2026-04" },
      { id: "hist-0258h72", categoryId: "cat-allowance", amount: 39.33, month: "2026-04" },
      { id: "hist-013sprw", categoryId: "cat-eatingout", amount: 10.85, month: "2026-04" },
      { id: "hist-7pbzthl", categoryId: "cat-coffee", amount: 12.09, month: "2026-04" },
      { id: "hist-dvrrqns", categoryId: "cat-eatingout", amount: 7.99, month: "2026-04" },
      { id: "hist-o831ws8", categoryId: "cat-allowance", amount: 64.58, month: "2026-04" },
      { id: "hist-9vbc7cf", categoryId: "cat-eatingout", amount: 21.72, month: "2026-04" },
      { id: "hist-vgdz4zq", categoryId: "cat-coffee", amount: 12.58, month: "2026-04" },
      { id: "hist-22vta59", categoryId: "cat-allowance", amount: 100, month: "2026-04" },
      { id: "hist-39fggsx", categoryId: "cat-eatingout", amount: 20.17, month: "2026-04" },
      { id: "hist-0x7sliz", categoryId: "cat-eatingout", amount: 15.27, month: "2026-04" },
      { id: "hist-w79u2zu", categoryId: "cat-eatingout", amount: 8.79, month: "2026-04" },
      { id: "hist-zc46b6p", categoryId: "cat-eatingout", amount: 31.94, month: "2026-04" },
      { id: "hist-2gi4b1j", categoryId: "cat-eatingout", amount: 29.95, month: "2026-04" },
      { id: "hist-lzhl782", categoryId: "cat-coffee", amount: 12.09, month: "2026-04" },
      { id: "hist-x24p5o9", categoryId: "cat-coffee", amount: 12.58, month: "2026-03" },
      { id: "hist-gwssze8", categoryId: "cat-allowance", amount: 20, month: "2026-03" },
      { id: "hist-x4vg52l", categoryId: "cat-allowance", amount: 200, month: "2026-03" },
      { id: "hist-7mue1ke", categoryId: "cat-fuel", amount: 10, month: "2026-03" },
      { id: "hist-2fux6bu", categoryId: "cat-eatingout", amount: 12.53, month: "2026-03" },
      { id: "hist-7t9vqap", categoryId: "cat-eatingout", amount: 10.76, month: "2026-03" },
      { id: "hist-hxyvl1s", categoryId: "cat-eatingout", amount: 7.98, month: "2026-03" },
      { id: "hist-zymor8c", categoryId: "cat-eatingout", amount: 19.21, month: "2026-03" },
      { id: "hist-vunrmms", categoryId: "cat-eatingout", amount: 11.73, month: "2026-03" },
      { id: "hist-pp3duru", categoryId: "cat-coffee", amount: 6.27, month: "2026-03" },
      { id: "hist-i18bg42", categoryId: "cat-coffee", amount: 12.58, month: "2026-03" },
      { id: "hist-lirml53", categoryId: "cat-entertainment", amount: 52, month: "2026-03" },
      { id: "hist-j0qynyr", categoryId: "cat-fuel", amount: 20, month: "2026-03" },
      { id: "hist-ki53b3f", categoryId: "cat-eatingout", amount: 13.96, month: "2026-03" },
      { id: "hist-nvl5ehl", categoryId: "cat-coffee", amount: 15.4, month: "2026-03" },
      { id: "hist-lv0jw5p", categoryId: "cat-eatingout", amount: 11.2, month: "2026-03" },
      { id: "hist-y2flu7d", categoryId: "cat-allowance", amount: 200, month: "2026-03" },
      { id: "hist-gpc6oau", categoryId: "cat-entertainment", amount: 39.33, month: "2026-03" },
      { id: "hist-m8sh0tq", categoryId: "cat-eatingout", amount: 14.51, month: "2026-02" },
      { id: "hist-um5gdut", categoryId: "cat-eatingout", amount: 10.57, month: "2026-02" },
      { id: "hist-zsyiryb", categoryId: "cat-coffee", amount: 6.29, month: "2026-02" },
      { id: "hist-0nupk5p", categoryId: "cat-eatingout", amount: 30.56, month: "2026-02" },
      { id: "hist-rdhgaxn", categoryId: "cat-entertainment", amount: 80.81, month: "2026-02" },
      { id: "hist-h2b7497", categoryId: "cat-entertainment", amount: 4.45, month: "2026-02" },
      { id: "hist-6co1zsj", categoryId: "cat-grocery", amount: 665.72, month: "2026-02" },
      { id: "hist-r0kdrjj", categoryId: "cat-allowance", amount: 250, month: "2026-02" },
      { id: "hist-9lh0i16", categoryId: "cat-fuel", amount: 27.28, month: "2026-02" },
      { id: "hist-0lf2kms", categoryId: "cat-eatingout", amount: 25.56, month: "2026-02" },
      { id: "hist-klhhp3g", categoryId: "cat-eatingout", amount: 8.79, month: "2026-02" },
      { id: "hist-86zvqt5", categoryId: "cat-entertainment", amount: 39.33, month: "2026-02" },
      { id: "hist-ozfr9q1", categoryId: "cat-coffee", amount: 6.29, month: "2026-02" },
      { id: "hist-vpp6xlh", categoryId: "cat-entertainment", amount: 67.79, month: "2026-02" },
      { id: "hist-c1tm6wc", categoryId: "cat-eatingout", amount: 16.68, month: "2026-02" },
      { id: "hist-gkwqy1t", categoryId: "cat-eatingout", amount: 19.67, month: "2026-02" },
      { id: "hist-ofp6v2l", categoryId: "cat-coffee", amount: 6.26, month: "2026-02" },
      { id: "hist-d7oki32", categoryId: "cat-eatingout", amount: 6.03, month: "2026-02" },
      { id: "hist-g2476cn", categoryId: "cat-allowance", amount: 10, month: "2026-02" },
      { id: "hist-bsylwml", categoryId: "cat-eatingout", amount: 35, month: "2026-02" },
      { id: "hist-e4yjo8u", categoryId: "cat-allowance", amount: 750, month: "2026-02" },
      { id: "hist-hy01k6a", categoryId: "cat-fuel", amount: 20, month: "2026-02" },
      { id: "hist-z2w7aa8", categoryId: "cat-eatingout", amount: 25.53, month: "2026-02" },
      { id: "hist-epbdawg", categoryId: "cat-allowance", amount: 10, month: "2026-02" },
      { id: "hist-rh2ho7h", categoryId: "cat-eatingout", amount: 15.72, month: "2026-02" },
      { id: "hist-dmf4ukp", categoryId: "cat-eatingout", amount: 37.19, month: "2026-02" },
      { id: "hist-7sfnaqf", categoryId: "cat-allowance", amount: 200, month: "2026-02" },
      { id: "hist-9ymth3u", categoryId: "cat-coffee", amount: 4.25, month: "2026-02" },
      { id: "hist-ofl10yt", categoryId: "cat-grocery", amount: 750, month: "2026-01" },
      { id: "hist-ganfjm7", categoryId: "cat-allowance", amount: 250, month: "2026-01" },
      { id: "hist-nzrhxzf", categoryId: "cat-eatingout", amount: 10.44, month: "2026-01" },
      { id: "hist-yvz0j73", categoryId: "cat-eatingout", amount: 10.27, month: "2026-01" },
      { id: "hist-vgbl9js", categoryId: "cat-eatingout", amount: 20, month: "2026-01" },
      { id: "hist-kwp2x4i", categoryId: "cat-entertainment", amount: 40, month: "2026-01" },
      { id: "hist-msi4yp7", categoryId: "cat-eatingout", amount: 9.82, month: "2026-01" },
      { id: "hist-ts97aqa", categoryId: "cat-eatingout", amount: 21.67, month: "2026-01" },
      { id: "hist-ug85p4t", categoryId: "cat-entertainment", amount: 21.82, month: "2026-01" },
      { id: "hist-u8cxzhn", categoryId: "cat-eatingout", amount: 28.59, month: "2026-01" },
      { id: "hist-bptbavf", categoryId: "cat-entertainment", amount: 40, month: "2026-01" },
      { id: "hist-s6pnudv", categoryId: "cat-eatingout", amount: 23.83, month: "2026-01" },
      { id: "hist-6s8c7bn", categoryId: "cat-eatingout", amount: 9.71, month: "2026-01" },
      { id: "hist-z6zo9i2", categoryId: "cat-entertainment", amount: 40, month: "2026-01" },
      { id: "hist-twma189", categoryId: "cat-eatingout", amount: 15.85, month: "2026-01" },
      { id: "hist-dm0i956", categoryId: "cat-eatingout", amount: 15.26, month: "2026-01" },
      { id: "hist-qr54gnd", categoryId: "cat-grocery", amount: 14, month: "2026-01" },
    ],
    transactions: [
      { id: "hist-4fyanp4", date: "2026-06-17", type: "correction", description: "Adjustment", amount: 637.42, account: "Checking" },
      { id: "hist-6itgmll", date: "2026-06-17", type: "debt-payment", description: "Credit Card", amount: -500, account: "Credit Card (unspecified)" },
      { id: "hist-uy0ndli", date: "2026-06-17", type: "bill", description: "Consolidation Loan", amount: -700, account: "Checking" },
      { id: "hist-kslmbrt", date: "2026-06-17", type: "bill", description: "Utilities", amount: -200, account: "Checking" },
      { id: "hist-u2j5vzl", date: "2026-06-17", type: "debt-payment", description: "Credit Card", amount: -250, account: "Credit Card (unspecified)" },
      { id: "hist-vmipjby", date: "2026-06-17", type: "transfer", description: "Savings", amount: -499.22, account: "Savings" },
      { id: "hist-ohg57cj", date: "2026-06-17", type: "expense", description: "Allowance", amount: -250, account: "Checking" },
      { id: "hist-p5mshsx", date: "2026-06-12", type: "bill", description: "Amazon", amount: -14.99, account: "Checking" },
      { id: "hist-eslc74k", date: "2026-06-02", type: "debt-payment", description: "Credit Card", amount: -2000, account: "Credit Card (unspecified)" },
      { id: "hist-9hsgbni", date: "2026-06-02", type: "debt-payment", description: "Credit Card", amount: -500, account: "Credit Card (unspecified)" },
      { id: "hist-1zedsmt", date: "2026-06-02", type: "debt-payment", description: "Credit Card", amount: -30, account: "Credit Card (unspecified)" },
      { id: "hist-tcog3md", date: "2026-05-31", type: "expense", description: "Apartment", amount: -143.95, account: "Checking" },
      { id: "hist-bt1dpyy", date: "2026-05-22", type: "expense", description: "Eating Out", amount: -80, account: "Checking" },
      { id: "hist-e9252g6", date: "2026-05-21", type: "bill", description: "Consolidation Loan", amount: -700, account: "Checking" },
      { id: "hist-348dh8t", date: "2026-05-20", type: "bill", description: "Phone", amount: -122.28, account: "Checking" },
      { id: "hist-z1cfga4", date: "2026-05-20", type: "debt-payment", description: "Credit Card", amount: -500, account: "Credit Card (unspecified)" },
      { id: "hist-nwqt88t", date: "2026-05-20", type: "transfer", description: "Savings", amount: -250, account: "Savings" },
      { id: "hist-a6hqpqm", date: "2026-05-16", type: "expense", description: "Eating Out", amount: -59.16, account: "Checking" },
      { id: "hist-wmt7z4j", date: "2026-05-16", type: "expense", description: "Entertainment", amount: -57.62, account: "Checking" },
      { id: "hist-5eikh1n", date: "2026-05-15", type: "expense", description: "Entertainment", amount: -39.33, account: "Checking" },
      { id: "hist-qr8z71j", date: "2026-05-12", type: "bill", description: "Amazon", amount: -14.99, account: "Checking" },
      { id: "hist-f303i5z", date: "2026-05-11", type: "expense", description: "Eating Out", amount: -35.91, account: "Checking" },
      { id: "hist-yip47dh", date: "2026-05-10", type: "expense", description: "Entertainment", amount: -68.85, account: "Checking" },
      { id: "hist-7m0pelp", date: "2026-05-10", type: "expense", description: "Eating Out", amount: -29.34, account: "Checking" },
      { id: "hist-h2r2d2t", date: "2026-05-09", type: "expense", description: "Entertainment", amount: -85.07, account: "Checking" },
      { id: "hist-2krmsio", date: "2026-05-06", type: "debt-payment", description: "Credit Card", amount: -752.99, account: "Credit Card (unspecified)" },
      { id: "hist-93qhp0h", date: "2026-05-06", type: "debt-payment", description: "Credit Card", amount: -400, account: "Credit Card (unspecified)" },
      { id: "hist-0brwx0w", date: "2026-05-04", type: "expense", description: "Allowance", amount: -65.56, account: "Checking" },
      { id: "hist-u0r8dyf", date: "2026-05-04", type: "income-other", description: "Replenish", amount: 400.73, account: "Checking" },
      { id: "hist-83x43dl", date: "2026-05-04", type: "transfer", description: "Savings", amount: -350, account: "Savings" },
      { id: "hist-6g350gn", date: "2026-05-01", type: "expense", description: "Entertainment", amount: -58.41, account: "Checking" },
      { id: "hist-401znxp", date: "2026-04-27", type: "expense", description: "Allowance", amount: -10, account: "Checking" },
      { id: "hist-rgmksfc", date: "2026-04-26", type: "expense", description: "Eating Out", amount: -21.86, account: "Checking" },
      { id: "hist-ouxgocs", date: "2026-04-26", type: "expense", description: "Allowance", amount: -10, account: "Checking" },
      { id: "hist-xh9v9vd", date: "2026-04-26", type: "expense", description: "Entertainment", amount: -38.22, account: "Checking" },
      { id: "hist-73e5tsz", date: "2026-04-26", type: "expense", description: "Eating Out", amount: -9.6, account: "Checking" },
      { id: "hist-wi08jbv", date: "2026-04-25", type: "debt-payment", description: "Credit Card", amount: -150, account: "Credit Card (unspecified)" },
      { id: "hist-want0ev", date: "2026-04-24", type: "expense", description: "Fuel", amount: -30, account: "Checking" },
      { id: "hist-knoqfzo", date: "2026-04-22", type: "bill", description: "Consolidation Loan", amount: -700, account: "Checking" },
      { id: "hist-202bmt7", date: "2026-04-22", type: "debt-payment", description: "Credit Card", amount: -800, account: "Credit Card (unspecified)" },
      { id: "hist-id7rxwn", date: "2026-04-22", type: "transfer", description: "Savings", amount: -250, account: "Savings" },
      { id: "hist-sgj3k4d", date: "2026-04-22", type: "expense", description: "Allowance", amount: -200, account: "Checking" },
      { id: "hist-gohyug4", date: "2026-04-20", type: "expense", description: "Coffee", amount: -6.26, account: "Checking" },
      { id: "hist-iina40e", date: "2026-04-20", type: "expense", description: "Eating Out", amount: -15.63, account: "Checking" },
      { id: "hist-y9lbqbv", date: "2026-04-19", type: "expense", description: "Eating Out", amount: -29.5, account: "Checking" },
      { id: "hist-p1nq1a7", date: "2026-04-19", type: "expense", description: "Coffee", amount: -10.72, account: "Checking" },
      { id: "hist-i1nx9sw", date: "2026-04-18", type: "expense", description: "Allowance", amount: -39.33, account: "Checking" },
      { id: "hist-og157bb", date: "2026-04-18", type: "expense", description: "Eating Out", amount: -10.85, account: "Checking" },
      { id: "hist-3hemg8y", date: "2026-04-16", type: "bill", description: "Utilities", amount: -100, account: "Checking" },
      { id: "hist-0nhuolr", date: "2026-04-16", type: "bill", description: "Phone", amount: -122.24, account: "Checking" },
      { id: "hist-cir5rir", date: "2026-04-15", type: "expense", description: "Coffee", amount: -12.09, account: "Checking" },
      { id: "hist-nosvoi5", date: "2026-04-15", type: "expense", description: "Eating Out", amount: -7.99, account: "Checking" },
      { id: "hist-s4irflc", date: "2026-04-12", type: "bill", description: "Amazon", amount: -14.99, account: "Checking" },
      { id: "hist-sp8p1su", date: "2026-04-12", type: "expense", description: "Allowance", amount: -64.58, account: "Checking" },
      { id: "hist-vleyvjm", date: "2026-04-10", type: "expense", description: "Eating Out", amount: -21.72, account: "Checking" },
      { id: "hist-su3rez0", date: "2026-04-10", type: "expense", description: "Coffee", amount: -12.58, account: "Checking" },
      { id: "hist-1qlmo17", date: "2026-04-10", type: "expense", description: "Allowance", amount: -100, account: "Checking" },
      { id: "hist-w3olw7o", date: "2026-04-09", type: "expense", description: "Eating Out", amount: -20.17, account: "Checking" },
      { id: "hist-q6j0z7i", date: "2026-04-08", type: "correction", description: "Adjustment", amount: 2.31, account: "Checking" },
      { id: "hist-vq4htqx", date: "2026-04-08", type: "debt-payment", description: "Credit Card", amount: -400, account: "Credit Card (unspecified)" },
      { id: "hist-vhutoyf", date: "2026-04-08", type: "debt-payment", description: "Credit Card", amount: -149.15, account: "Credit Card (unspecified)" },
      { id: "hist-c5p7b68", date: "2026-04-07", type: "expense", description: "Eating Out", amount: -15.27, account: "Checking" },
      { id: "hist-0dly8bx", date: "2026-04-04", type: "expense", description: "Eating Out", amount: -8.79, account: "Checking" },
      { id: "hist-cx8jks5", date: "2026-04-03", type: "expense", description: "Eating Out", amount: -31.94, account: "Checking" },
      { id: "hist-ryq72lb", date: "2026-04-02", type: "expense", description: "Eating Out", amount: -29.95, account: "Checking" },
      { id: "hist-jn4qzxp", date: "2026-04-01", type: "expense", description: "Coffee", amount: -12.09, account: "Checking" },
      { id: "hist-x8o7emw", date: "2026-04-01", type: "expense", description: "Taxes", amount: -63, account: "Checking" },
      { id: "hist-z9b8l5y", date: "2026-03-31", type: "expense", description: "Coffee", amount: -12.58, account: "Checking" },
      { id: "hist-4a8idgq", date: "2026-03-27", type: "expense", description: "Allowance", amount: -20, account: "Checking" },
      { id: "hist-mcu5ncf", date: "2026-03-25", type: "debt-payment", description: "Credit Card", amount: -750, account: "Credit Card (unspecified)" },
      { id: "hist-rl0so0t", date: "2026-03-25", type: "expense", description: "Allowance", amount: -200, account: "Checking" },
      { id: "hist-816yqmz", date: "2026-03-25", type: "debt-payment", description: "Credit Card", amount: -200, account: "Credit Card (unspecified)" },
      { id: "hist-gjwdjsd", date: "2026-03-25", type: "transfer", description: "Savings", amount: -150, account: "Savings" },
      { id: "hist-liconwh", date: "2026-03-25", type: "expense", description: "Fuel", amount: -10, account: "Checking" },
      { id: "hist-spnyzr1", date: "2026-03-25", type: "expense", description: "Eating Out", amount: -12.53, account: "Checking" },
      { id: "hist-jso785l", date: "2026-03-23", type: "expense", description: "Eating Out", amount: -10.76, account: "Checking" },
      { id: "hist-ajp45pw", date: "2026-03-22", type: "expense", description: "Eating Out", amount: -7.98, account: "Checking" },
      { id: "hist-i236hs1", date: "2026-03-21", type: "expense", description: "Eating Out", amount: -19.21, account: "Checking" },
      { id: "hist-9jt0kri", date: "2026-03-21", type: "expense", description: "Eating Out", amount: -11.73, account: "Checking" },
      { id: "hist-1k4x1zg", date: "2026-03-20", type: "expense", description: "Coffee", amount: -6.27, account: "Checking" },
      { id: "hist-vamw3ox", date: "2026-03-20", type: "expense", description: "Coffee", amount: -12.58, account: "Checking" },
      { id: "hist-mibod2z", date: "2026-03-20", type: "expense", description: "Entertainment", amount: -52, account: "Checking" },
      { id: "hist-o89y515", date: "2026-03-18", type: "expense", description: "Fuel", amount: -20, account: "Checking" },
      { id: "hist-d5kwbk4", date: "2026-03-17", type: "expense", description: "Eating Out", amount: -13.96, account: "Checking" },
      { id: "hist-z1vuz32", date: "2026-03-16", type: "bill", description: "Phone", amount: -122.34, account: "Checking" },
      { id: "hist-2gbo1pz", date: "2026-03-15", type: "bill", description: "Utilities", amount: -100, account: "Checking" },
      { id: "hist-4mltw1p", date: "2026-03-15", type: "debt-payment", description: "Credit Card", amount: -250, account: "Credit Card (unspecified)" },
      { id: "hist-j7d3dxy", date: "2026-03-14", type: "expense", description: "Coffee", amount: -15.4, account: "Checking" },
      { id: "hist-zj2q8gb", date: "2026-03-12", type: "bill", description: "Amazon", amount: -14.99, account: "Checking" },
      { id: "hist-2v980a2", date: "2026-03-11", type: "bill", description: "Consolidation Loan", amount: -700, account: "Checking" },
      { id: "hist-zkce4q4", date: "2026-03-11", type: "debt-payment", description: "Credit Card", amount: -500, account: "Credit Card (unspecified)" },
      { id: "hist-s7ivyhi", date: "2026-03-11", type: "expense", description: "Eating Out", amount: -11.2, account: "Checking" },
      { id: "hist-4gl1ykz", date: "2026-03-10", type: "expense", description: "Allowance", amount: -200, account: "Checking" },
      { id: "hist-dlexi2d", date: "2026-03-10", type: "transfer", description: "Savings", amount: -150, account: "Savings" },
      { id: "hist-hqxwk62", date: "2026-03-09", type: "correction", description: "Correction", amount: -110.59, account: "Checking" },
      { id: "hist-igwxfm7", date: "2026-03-09", type: "expense", description: "Entertainment", amount: -39.33, account: "Checking" },
      { id: "hist-yltd87r", date: "2026-02-28", type: "expense", description: "Eating Out", amount: -14.51, account: "Checking" },
      { id: "hist-fw0hswz", date: "2026-02-26", type: "expense", description: "Eating Out", amount: -10.57, account: "Checking" },
      { id: "hist-jv8up49", date: "2026-02-26", type: "expense", description: "Coffee", amount: -6.29, account: "Checking" },
      { id: "hist-6ttua2v", date: "2026-02-26", type: "expense", description: "Eating Out", amount: -30.56, account: "Checking" },
      { id: "hist-gc9hziu", date: "2026-02-26", type: "expense", description: "Entertainment", amount: -80.81, account: "Checking" },
      { id: "hist-wy6inl1", date: "2026-02-26", type: "expense", description: "Entertainment", amount: -4.45, account: "Checking" },
      { id: "hist-fw0sx3f", date: "2026-02-25", type: "expense", description: "Subscription", amount: -2.99, account: "Checking" },
      { id: "hist-6y5xcvk", date: "2026-02-25", type: "expense", description: "GG Budget", amount: -665.72, account: "Checking" },
      { id: "hist-3cn55md", date: "2026-02-25", type: "debt-payment", description: "Credit Card", amount: -500, account: "Credit Card (unspecified)" },
      { id: "hist-gwheb78", date: "2026-02-25", type: "transfer", description: "Savings", amount: -250, account: "Savings" },
      { id: "hist-dbd9oq5", date: "2026-02-25", type: "expense", description: "Allowance", amount: -250, account: "Checking" },
      { id: "hist-jkjxhdr", date: "2026-02-25", type: "expense", description: "Gifts", amount: -37.22, account: "Checking" },
      { id: "hist-2omjta7", date: "2026-02-25", type: "expense", description: "Fuel", amount: -27.28, account: "Checking" },
      { id: "hist-odk8pbj", date: "2026-02-24", type: "expense", description: "Eating Out", amount: -25.56, account: "Checking" },
      { id: "hist-3qffxep", date: "2026-02-24", type: "expense", description: "Eating Out", amount: -8.79, account: "Checking" },
      { id: "hist-58oq7og", date: "2026-02-24", type: "expense", description: "Entertainment", amount: -39.33, account: "Checking" },
      { id: "hist-28tz2r5", date: "2026-02-24", type: "expense", description: "Coffee", amount: -6.29, account: "Checking" },
      { id: "hist-jgcn5we", date: "2026-02-24", type: "expense", description: "Various", amount: -8.79, account: "Checking" },
      { id: "hist-4ew7jvh", date: "2026-02-23", type: "expense", description: "Entertainment", amount: -67.79, account: "Checking" },
      { id: "hist-11hhzma", date: "2026-02-23", type: "expense", description: "Subscription", amount: -3.99, account: "Checking" },
      { id: "hist-05gy28j", date: "2026-02-22", type: "expense", description: "Eating Out", amount: -16.68, account: "Checking" },
      { id: "hist-8y0755z", date: "2026-02-21", type: "expense", description: "Eating Out", amount: -19.67, account: "Checking" },
      { id: "hist-3svkdtq", date: "2026-02-21", type: "expense", description: "Coffee", amount: -6.26, account: "Checking" },
      { id: "hist-pcst97i", date: "2026-02-21", type: "expense", description: "Eating Out", amount: -6.03, account: "Checking" },
      { id: "hist-ynh0eu0", date: "2026-02-20", type: "expense", description: "Allowance", amount: -10, account: "Checking" },
      { id: "hist-08kp1e8", date: "2026-02-20", type: "bill", description: "Phone", amount: -107.7, account: "Checking" },
      { id: "hist-j1llizk", date: "2026-02-20", type: "expense", description: "Eating Out", amount: -35, account: "Checking" },
      { id: "hist-pdc4ixu", date: "2026-02-18", type: "income-other", description: "Refund", amount: 6434.41, account: "Checking" },
      { id: "hist-xbb6n38", date: "2026-02-18", type: "transfer", description: "Savings", amount: -1697.08, account: "Savings" },
      { id: "hist-wnrbz8e", date: "2026-02-18", type: "debt-payment", description: "Credit Card", amount: -1700, account: "Credit Card (unspecified)" },
      { id: "hist-4292edn", date: "2026-02-18", type: "debt-payment", description: "Credit Card", amount: -1000, account: "Credit Card (unspecified)" },
      { id: "hist-g196ebw", date: "2026-02-18", type: "expense", description: "Allowance", amount: -750, account: "Checking" },
      { id: "hist-w5d14pn", date: "2026-02-18", type: "expense", description: "Fuel", amount: -20, account: "Checking" },
      { id: "hist-hu2s7xd", date: "2026-02-18", type: "expense", description: "Eating Out", amount: -25.53, account: "Checking" },
      { id: "hist-c6bh5j4", date: "2026-02-16", type: "expense", description: "Allowance", amount: -10, account: "Checking" },
      { id: "hist-fgajtc7", date: "2026-02-15", type: "bill", description: "Utilities", amount: -100, account: "Checking" },
      { id: "hist-74lq3bk", date: "2026-02-12", type: "bill", description: "Amazon", amount: -14.99, account: "Checking" },
      { id: "hist-scoutdw", date: "2026-02-12", type: "expense", description: "Eating Out", amount: -15.72, account: "Checking" },
      { id: "hist-cjq6d8x", date: "2026-02-12", type: "expense", description: "Gifts", amount: -32.09, account: "Checking" },
      { id: "hist-rzp16c6", date: "2026-02-12", type: "expense", description: "Eating Out", amount: -37.19, account: "Checking" },
      { id: "hist-z7oco6q", date: "2026-02-11", type: "bill", description: "Consolidation Loan", amount: -700, account: "Checking" },
      { id: "hist-5wmat34", date: "2026-02-11", type: "debt-payment", description: "Credit Card", amount: -1000, account: "Credit Card (unspecified)" },
      { id: "hist-8cqyn58", date: "2026-02-11", type: "expense", description: "Allowance", amount: -200, account: "Checking" },
      { id: "hist-9bz966h", date: "2026-02-11", type: "transfer", description: "Savings", amount: -250, account: "Savings" },
      { id: "hist-xx4pr4x", date: "2026-02-09", type: "expense", description: "Coffee", amount: -4.25, account: "Checking" },
      { id: "hist-buwhskg", date: "2026-02-09", type: "expense", description: "Various", amount: -153.86, account: "Checking" },
      { id: "hist-vjfuyjt", date: "2026-02-04", type: "income-other", description: "Refund", amount: 1300, account: "Checking" },
      { id: "hist-ctkoolx", date: "2026-02-04", type: "transfer", description: "Savings", amount: -233.81, account: "Savings" },
      { id: "hist-7sk87q9", date: "2026-02-04", type: "debt-payment", description: "Credit Card", amount: -796.23, account: "Credit Card (unspecified)" },
      { id: "hist-e08v302", date: "2026-02-03", type: "expense", description: "Work Expense", amount: -67.55, account: "Checking" },
      { id: "hist-dgmhzym", date: "2026-02-02", type: "expense", description: "Haircut", amount: -91, account: "Checking" },
      { id: "hist-tp0unbz", date: "2026-01-28", type: "expense", description: "Groceries", amount: -750, account: "Checking" },
      { id: "hist-pifyvh9", date: "2026-01-28", type: "debt-payment", description: "Credit Card", amount: -506, account: "Credit Card (unspecified)" },
      { id: "hist-v2q2tey", date: "2026-01-28", type: "transfer", description: "Savings", amount: -250, account: "Savings" },
      { id: "hist-aud1zb0", date: "2026-01-28", type: "expense", description: "Allowance", amount: -250, account: "Checking" },
      { id: "hist-4i2wqq3", date: "2026-01-20", type: "expense", description: "Various", amount: -38.35, account: "Checking" },
      { id: "hist-yd2z6em", date: "2026-01-20", type: "expense", description: "Eating Out", amount: -10.44, account: "Checking" },
      { id: "hist-85wxwhx", date: "2026-01-18", type: "expense", description: "Work Expense", amount: -24.24, account: "Checking" },
      { id: "hist-bp1a5ih", date: "2026-01-17", type: "expense", description: "Eating Out", amount: -10.27, account: "Checking" },
      { id: "hist-k8p3zin", date: "2026-01-17", type: "expense", description: "Work Expense", amount: -16.04, account: "Checking" },
      { id: "hist-ph4h2hw", date: "2026-01-16", type: "bill", description: "Utilities", amount: -95, account: "Checking" },
      { id: "hist-uu0q4h0", date: "2026-01-16", type: "bill", description: "Phone", amount: -127.96, account: "Checking" },
      { id: "hist-sarv3no", date: "2026-01-16", type: "debt-payment", description: "Credit Card", amount: -350, account: "Credit Card (unspecified)" },
      { id: "hist-czipg4b", date: "2026-01-15", type: "bill", description: "Consolidation Loan", amount: -700, account: "Checking" },
      { id: "hist-8rf8ea4", date: "2026-01-15", type: "debt-payment", description: "Credit Card", amount: -250, account: "Credit Card (unspecified)" },
      { id: "hist-t6y7c7m", date: "2026-01-15", type: "expense", description: "Clothes", amount: -30.22, account: "Checking" },
      { id: "hist-izyrnxv", date: "2026-01-13", type: "income-other", description: "Carry Over", amount: 19.65, account: "Checking" },
      { id: "hist-528na5g", date: "2026-01-13", type: "expense", description: "Eating Out", amount: -20, account: "Checking" },
      { id: "hist-nfsx0wp", date: "2026-01-13", type: "expense", description: "Entertainment", amount: -40, account: "Checking" },
      { id: "hist-15shqeb", date: "2026-01-12", type: "bill", description: "Amazon", amount: -14.99, account: "Checking" },
      { id: "hist-al9sowy", date: "2026-01-12", type: "expense", description: "Eating Out", amount: -9.82, account: "Checking" },
      { id: "hist-luh01f6", date: "2026-01-12", type: "expense", description: "Eating Out", amount: -21.67, account: "Checking" },
      { id: "hist-fzxkana", date: "2026-01-11", type: "expense", description: "Entertainment", amount: -21.82, account: "Checking" },
      { id: "hist-3u7groh", date: "2026-01-11", type: "expense", description: "Eating Out", amount: -28.59, account: "Checking" },
      { id: "hist-l94y743", date: "2026-01-11", type: "expense", description: "Entertainment", amount: -40, account: "Checking" },
      { id: "hist-u1wkk52", date: "2026-01-10", type: "expense", description: "Eating Out", amount: -23.83, account: "Checking" },
      { id: "hist-wepfsz3", date: "2026-01-10", type: "expense", description: "Subscription", amount: -3.99, account: "Checking" },
      { id: "hist-lzn684t", date: "2026-01-10", type: "expense", description: "Eating Out", amount: -9.71, account: "Checking" },
      { id: "hist-jn9zu08", date: "2026-01-09", type: "expense", description: "Entertainment", amount: -40, account: "Checking" },
      { id: "hist-tr3ayzx", date: "2026-01-09", type: "correction", description: "Correction", amount: -51.27, account: "Checking" },
      { id: "hist-hs5ofj8", date: "2026-01-08", type: "expense", description: "Eating Out", amount: -15.85, account: "Checking" },
      { id: "hist-b1c86ix", date: "2026-01-07", type: "expense", description: "School", amount: -23.66, account: "Checking" },
      { id: "hist-eaxzdi8", date: "2026-01-05", type: "expense", description: "Gifts", amount: -20, account: "Checking" },
      { id: "hist-zvxntol", date: "2026-01-04", type: "debt-payment", description: "Credit Card", amount: -100, account: "Credit Card (unspecified)" },
      { id: "hist-33polrg", date: "2026-01-02", type: "debt-payment", description: "Credit Card", amount: -500, account: "Credit Card (unspecified)" },
      { id: "hist-lfk3p3r", date: "2026-01-01", type: "expense", description: "Holidays", amount: -30, account: "Checking" },
      { id: "hist-tkp1buk", date: "2026-01-01", type: "expense", description: "Eating Out", amount: -15.26, account: "Checking" },
      { id: "hist-be4cqe4", date: "2026-01-01", type: "expense", description: "Groceries", amount: -14, account: "Checking" },
    ],
    history: [{ date: todayStr(), checking, savings, debt: debtTotal }],
  };
}


// One history doc per day (upserted by date), so every balance-affecting
// mutation hands this to commit()'s `add.history` to keep the Trends chart
// current -- Firestore naturally dedupes same-day entries by doc ID.
function historyEntry(nextData) {
  const today = todayStr();
  const debtTotal = (nextData.debts || []).reduce((s, d) => s + accrueDebt(d, today).balance, 0);
  return { date: today, checking: Number(nextData.checking), savings: Number(nextData.savings), debt: debtTotal };
}

/* ---------- shared table primitives now live in ./ui ---------- */

function sourceLabel(sourceId, options) {
  const opt = options.find((o) => o.id === sourceId);
  return opt ? opt.label : "Checking";
}

/* ---------- trend chart (kept as a chart, restyled plain) ---------- */

const SERIES = [
  { key: "checking", label: "Checking", color: TEAL },
  { key: "savings", label: "Savings", color: GOLD },
  { key: "debt", label: "Debt", color: BRICK },
  { key: "netWorth", label: "Net worth", color: MUTE },
];

function addPeriod(date, granularity) {
  const d = new Date(date);
  if (granularity === "day") d.setDate(d.getDate() + 1);
  else if (granularity === "week") d.setDate(d.getDate() + 7);
  else if (granularity === "month") d.setMonth(d.getMonth() + 1);
  else if (granularity === "quarter") d.setMonth(d.getMonth() + 3);
  else if (granularity === "year") d.setFullYear(d.getFullYear() + 1);
  return d;
}
function labelFor(date, granularity) {
  if (granularity === "day" || granularity === "week") return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (granularity === "month") return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  if (granularity === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} '${String(date.getFullYear()).slice(2)}`;
  return String(date.getFullYear());
}
const RANGE_DAYS = { day: 60, week: 182, month: 730, quarter: 1095, year: 1825 };

function buildTrendPoints(history, granularity) {
  if (!history || history.length === 0) return [];
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = daysAgo(RANGE_DAYS[granularity]);
  const firstDate = new Date(sorted[0].date);
  const start = firstDate > cutoff ? firstDate : cutoff;
  const today = new Date();
  const points = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= today && guard < 600) {
    guard++;
    const dateStr = cursor.toISOString().slice(0, 10);
    let entry = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].date <= dateStr) { entry = sorted[i]; break; }
    }
    if (entry) {
      points.push({
        date: dateStr, checking: entry.checking, savings: entry.savings, debt: entry.debt || 0,
        netWorth: entry.checking + entry.savings - (entry.debt || 0), label: labelFor(cursor, granularity),
      });
    }
    cursor = addPeriod(cursor, granularity);
  }
  return points;
}

function buildMonthlySummary(data) {
  const totals = new Map();
  const bump = (month, key, amount) => {
    if (!month) return;
    if (!totals.has(month)) totals.set(month, { month, income: 0, spending: 0 });
    // Math.abs sidesteps inconsistent sign conventions between historical and
    // live-logged transactions — safe here since we only need spend magnitude.
    totals.get(month)[key] += Math.abs(Number(amount || 0));
  };
  for (const p of data.income || []) bump(p.date?.slice(0, 7), "income", p.amount);
  for (const t of data.transactions || []) {
    if (t.type === "expense" || t.type === "bill") bump(t.date?.slice(0, 7), "spending", t.amount);
  }
  return [...totals.values()].sort((a, b) => a.month.localeCompare(b.month));
}
function monthLabel(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function MonthlyBarChart({ data }) {
  const W = 700, H = 220, PAD_L = 58, PAD_R = 14, PAD_T = 14, PAD_B = 34;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(...data.flatMap((d) => [d.income, d.spending]), 1);
  const groupW = innerW / data.length;
  const barW = Math.min(20, groupW * 0.32);
  const x = (i) => PAD_L + groupW * i + groupW / 2;
  const y = (v) => PAD_T + innerH - (v / max) * innerH;
  const barH = (v) => (v / max) * innerH;
  const [hover, setHover] = useState(null);
  const gridLines = 4;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_T + (innerH / gridLines) * i;
          const val = max - (max / gridLines) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke={LINE} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontFamily={MONO} fontSize="10" fill={MUTE}>{fmtShort(val)}</text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <g key={d.month} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - barW - 2} y={y(d.income)} width={barW} height={Math.max(barH(d.income), 0)} fill={TEAL} />
            <rect x={x(i) + 2} y={y(d.spending)} width={barW} height={Math.max(barH(d.spending), 0)} fill={BRICK} />
            <rect x={x(i) - groupW / 2} y={PAD_T} width={groupW} height={innerH} fill="transparent" />
            <text x={x(i)} y={H - 14} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={MUTE}>{monthLabel(d.month)}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontFamily: MONO, fontSize: 11.5, color: INK, paddingLeft: 4 }}>
          <span style={{ color: MUTE }}>{monthLabel(data[hover].month)}</span>
          <span style={{ color: TEAL }}>Income {fmt(data[hover].income)}</span>
          <span style={{ color: BRICK }}>Spending {fmt(data[hover].spending)}</span>
        </div>
      )}
    </div>
  );
}

function TrendChart({ data, activeSeries }) {
  const W = 700, H = 230, PAD_L = 58, PAD_R = 14, PAD_T = 14, PAD_B = 26;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const allVals = data.flatMap((d) => activeSeries.map((s) => d[s.key]));
  const max = Math.max(...allVals, 1);
  const min = Math.min(...allVals, 0);
  const span = max - min || 1;
  const x = (i) => PAD_L + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD_T + innerH - ((v - min) / span) * innerH;
  const path = (key) => data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
  const [hover, setHover] = useState(null);
  const gridLines = 4;
  const step = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_T + (innerH / gridLines) * i;
          const val = max - (span / gridLines) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke={LINE} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontFamily={MONO} fontSize="10" fill={MUTE}>{fmtShort(val)}</text>
            </g>
          );
        })}
        {data.map((d, i) => i % step === 0 || i === data.length - 1 ? (
          <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={MUTE}>{d.label}</text>
        ) : null)}
        {activeSeries.map((s) => <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" />)}
        {data.map((d, i) => (
          <rect key={i} x={x(i) - innerW / Math.max(data.length - 1, 1) / 2} y={PAD_T}
            width={innerW / Math.max(data.length - 1, 1)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + innerH} stroke={INK} strokeOpacity="0.2" />
            {activeSeries.map((s) => <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r="3.5" fill={s.color} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontFamily: MONO, fontSize: 11.5, color: INK, paddingLeft: 4 }}>
          <span style={{ color: MUTE }}>{data[hover].label}</span>
          {activeSeries.map((s) => <span key={s.key} style={{ color: s.color }}>{s.label} {fmt(data[hover][s.key])}</span>)}
        </div>
      )}
    </div>
  );
}

/* ---------- auth + cloud data wrapper ---------- */

export default function App() {
  const user = useAuthUser();
  const { data, status, saveStatus, commit, removeItem, replaceAll } = useCloudLedger(!!user);

  return (
    <AuthGate user={user} forbidden={status === "forbidden"}>
      {status === "loading" && (
        <Centered bare><span style={{ fontFamily: MONO, color: MUTE, fontSize: 13 }}>loading…</span></Centered>
      )}
      {status === "migrating" && (
        <Centered bare><span style={{ fontFamily: MONO, color: MUTE, fontSize: 13 }}>upgrading your ledger's storage format…</span></Centered>
      )}
      {status === "error" && (
        <Centered bare><span style={{ fontFamily: MONO, color: BRICK, fontSize: 13 }}>Couldn't reach the ledger. Check your connection and reload.</span></Centered>
      )}
      {status === "ready" && data === null && (
        <Centered>
          <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 18px" }}>No shared ledger exists yet.</p>
          <Btn primary onClick={() => replaceAll(buildSeedData())}>Create ledger with starting data</Btn>
        </Centered>
      )}
      {status === "ready" && data !== null && (
        <Ledger data={data} commit={commit} removeItem={removeItem} replaceAll={replaceAll} saveStatus={saveStatus} userEmail={user?.email} onSignOut={() => signOut(auth)} />
      )}
    </AuthGate>
  );
}

function Ledger({ data, commit, removeItem, replaceAll, saveStatus, userEmail, onSignOut }) {
  const [spendForm, setSpendForm] = useState({ categoryId: "", amount: "" });
  const [transferAmt, setTransferAmt] = useState("");
  const [granularity, setGranularity] = useState("week");
  const [activeKeys, setActiveKeys] = useState(["checking", "savings", "netWorth"]);
  const [newPaycheck, setNewPaycheck] = useState({ date: todayStr(), amount: "", note: "", addToChecking: true });
  const [acctAmt, setAcctAmt] = useState({ checking: "", savings: "" });
  const [debtPay, setDebtPay] = useState({});
  const [showAllIncome, setShowAllIncome] = useState(false);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [page, setPage] = useState("ledger");
  const [reportMsg, setReportMsg] = useState("");
  const [whatIf, setWhatIf] = useState(() => ({ ...DEFAULT_ASSUMPTIONS, ...(data.assumptions || {}) }));

  const chartData = useMemo(() => buildTrendPoints(data.history, granularity), [data, granularity]);
  const monthlySummary = useMemo(() => buildMonthlySummary(data), [data]);

  const currentMonth = monthStr();
  const totalDebt = data.debts.reduce((s, d) => s + accrueDebt(d, todayStr()).balance, 0);
  const netWorth = Number(data.checking) + Number(data.savings) - totalDebt;

  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const inRange = (dateStr, days) => new Date(dateStr) >= daysAgo(days);
  const incomeThisMonth = data.income.filter((p) => p.date.slice(0, 7) === currentMonth).reduce((s, p) => s + Number(p.amount || 0), 0);
  const incomeThisQuarter = data.income.filter((p) => { const d = new Date(p.date); return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === q; }).reduce((s, p) => s + Number(p.amount || 0), 0);
  const incomeThisYear = data.income.filter((p) => p.date.slice(0, 4) === String(now.getFullYear())).reduce((s, p) => s + Number(p.amount || 0), 0);
  const last90 = data.income.filter((p) => inRange(p.date, 90));
  const avgMonthlyIncome = last90.reduce((s, p) => s + Number(p.amount || 0), 0) / 3;
  const sortedIncome = [...data.income].sort((a, b) => b.date.localeCompare(a.date));
  const last8Checks = sortedIncome.slice(0, 8);
  const avgPerCheck = last8Checks.length ? last8Checks.reduce((s, p) => s + Number(p.amount || 0), 0) / last8Checks.length : 0;
  const visibleIncome = showAllIncome ? sortedIncome : last8Checks;
  const last90Spend = data.transactions.filter((t) => (t.type === "expense" || t.type === "bill" || (t.type === "debt-payment" && t.account === "Checking")) && inRange(t.date, 90));
  const avgMonthlySpend = last90Spend.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0) / 3;
  const spendRatio = avgMonthlyIncome > 0 ? avgMonthlySpend / avgMonthlyIncome : null;

  const sourceOptionsBase = [{ id: "checking", label: "Checking" }, ...data.debts.map((d) => ({ id: d.id, label: d.name }))];
  const debtNameById = (id) => (data.debts.find((d) => d.id === id) || {}).name || id;

  /* ---- accounts ---- */
  const doAccountAdjust = (which, sign) => {
    const n = Number(acctAmt[which]);
    if (!n) return;
    const delta = sign * n;
    const nextVal = Number(data[which]) + delta;
    const next = { ...data, [which]: nextVal };
    commit({
      main: { [which]: nextVal },
      add: {
        transactions: [{ date: todayStr(), type: sign > 0 ? "deposit" : "withdrawal", description: "Manual entry", amount: n, account: which === "checking" ? "Checking" : "Savings" }],
        history: [historyEntry(next)],
      },
    });
    setAcctAmt({ ...acctAmt, [which]: "" });
  };
  const doTransfer = (direction) => {
    const n = Number(transferAmt);
    if (!n) return;
    let checking = Number(data.checking), savings = Number(data.savings);
    if (direction === "toSavings") { checking -= n; savings += n; } else { checking += n; savings -= n; }
    const next = { ...data, checking, savings };
    commit({
      main: { checking, savings },
      add: {
        transactions: [{ date: todayStr(), type: "transfer", description: direction === "toSavings" ? "Checking → Savings" : "Savings → Checking", amount: n, account: "Transfer" }],
        history: [historyEntry(next)],
      },
    });
    setTransferAmt("");
  };

  /* ---- income ---- */
  const addPaycheckEntry = () => {
    if (!newPaycheck.amount) return;
    const amount = Number(newPaycheck.amount);
    const date = newPaycheck.date || todayStr();
    const nextChecking = newPaycheck.addToChecking ? Number(data.checking) + amount : Number(data.checking);
    const next = { ...data, checking: nextChecking };
    commit({
      main: newPaycheck.addToChecking ? { checking: nextChecking } : undefined,
      add: {
        income: [{ date, amount, note: newPaycheck.note }],
        transactions: [{ date: todayStr(), type: "income", description: newPaycheck.note || "Paycheck", amount, account: newPaycheck.addToChecking ? "Checking" : "(not deposited)" }],
        history: [historyEntry(next)],
      },
    });
    setNewPaycheck({ date: todayStr(), amount: "", note: "", addToChecking: true });
  };
  const removePaycheck = (id) => {
    if (!window.confirm("Delete this paycheck entry?")) return;
    removeItem("income", id);
  };

  /* ---- spending ---- */
  const logSpend = () => {
    const catId = spendForm.categoryId || data.categories[0]?.id;
    const amt = Number(spendForm.amount);
    if (!catId || !amt) return;
    const cat = data.categories.find((c) => c.id === catId);
    const nextChecking = Number(data.checking) - amt;
    const next = { ...data, checking: nextChecking };
    commit({
      main: { checking: nextChecking },
      add: {
        expenses: [{ categoryId: catId, amount: amt, month: currentMonth }],
        transactions: [{ date: todayStr(), type: "expense", description: cat ? cat.name : "Expense", amount: amt, account: "Checking" }],
        history: [historyEntry(next)],
      },
    });
    setSpendForm({ ...spendForm, amount: "" });
  };

  /* ---- debts ---- */
  const payDebt = (id) => {
    const cfg = debtPay[id] || {};
    const amount = Number(cfg.amount);
    const source = cfg.source || "checking";
    if (!amount) return;
    const today = todayStr();
    let nextChecking = Number(data.checking);
    const nextDebts = data.debts.map((d) => {
      let nd = d;
      if (d.id === id) {
        nd = accrueDebt(nd, today);
        nd = { ...nd, balance: Math.max(0, nd.balance - amount), totalPaid: (nd.totalPaid || 0) + amount };
      }
      if (source !== "checking" && d.id === source) {
        nd = accrueDebt(nd, today);
        nd = { ...nd, balance: nd.balance + amount, totalCharged: (nd.totalCharged || 0) + amount };
      }
      return nd;
    });
    if (source === "checking") nextChecking -= amount;
    const next = { ...data, debts: nextDebts, checking: nextChecking };
    commit({
      main: { debts: nextDebts, checking: nextChecking },
      add: {
        transactions: [{ date: today, type: "debt-payment", description: debtNameById(id), amount, account: sourceLabel(source, sourceOptionsBase) }],
        history: [historyEntry(next)],
      },
    });
    setDebtPay({ ...debtPay, [id]: { ...cfg, amount: "" } });
  };
  const chargeDebt = (id) => {
    const cfg = debtPay[id] || {};
    const amount = Number(cfg.amount);
    if (!amount) return;
    const today = todayStr();
    const nextDebts = data.debts.map((d) => {
      if (d.id !== id) return d;
      const accrued = accrueDebt(d, today);
      return { ...accrued, balance: accrued.balance + amount, totalCharged: (d.totalCharged || 0) + amount };
    });
    const next = { ...data, debts: nextDebts };
    commit({
      main: { debts: nextDebts },
      add: {
        transactions: [{ date: today, type: "debt-charge", description: debtNameById(id), amount, account: debtNameById(id) }],
        history: [historyEntry(next)],
      },
    });
    setDebtPay({ ...debtPay, [id]: { ...cfg, amount: "" } });
  };
  const toggleSeries = (key) => setActiveKeys((k) => k.includes(key) ? k.filter((x) => x !== key) : [...k, key]);
  const activeSeries = SERIES.filter((s) => activeKeys.includes(s.key));
  const sortedTxns = [...(data.transactions || [])].sort((a, b) => b.date.localeCompare(a.date) || 0);
  const visibleTxns = showAllTxns ? sortedTxns : sortedTxns.slice(0, 40);
  const resetToSeed = () => {
    if (!window.confirm("Reset everything to your starting bills, debts, and balances? This clears any changes you've made.")) return;
    replaceAll(buildSeedData());
  };

  const downloadReport = () => {
    const md = buildReport({ data, whatIf });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `household-ledger-report-${todayStr()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setReportMsg("Report generated — check your downloads.");
  };

  return (
    <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS }}>
      <GlobalStyle />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 16, marginBottom: 4 }}>
          <div>
            <h1 style={{ fontFamily: SANS, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: INK }}>Household Ledger</h1>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE, marginTop: 3 }}>{new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn small primary onClick={downloadReport}>report</Btn>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>
              {userEmail} · <span onClick={onSignOut} style={{ cursor: "pointer", textDecoration: "underline" }}>sign out</span>
            </div>
          </div>
        </div>
        {reportMsg && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: TEAL, margin: "8px 0 0" }}>{reportMsg}</div>
        )}

        <div style={{ margin: "18px 0 6px" }}>
          <TabBar
            active={page}
            onChange={setPage}
            tabs={[
              { id: "ledger", label: "Ledger", icon: <IconLedger /> },
              { id: "debts", label: "Debts", icon: <IconDebts /> },
              { id: "plan", label: "Plan", icon: <IconPlan /> },
            ]}
          />
        </div>

        {page === "debts" && <Debts data={data} commit={commit} />}
        {page === "plan" && <Plan data={data} commit={commit} whatIf={whatIf} setWhatIf={setWhatIf} />}

        {page === "ledger" && (
        <>
        {/* Overview */}
        <SectionTitle>Overview</SectionTitle>
        <Table>
          <thead><tr>
            <Th align="right">Checking</Th><Th align="right">Savings</Th><Th align="right">Total Debt</Th>
            <Th align="right">Net Worth</Th><Th align="right">Avg Mo. Income</Th><Th align="right">Avg Mo. Spend</Th><Th align="right">Spend / Income</Th>
          </tr></thead>
          <tbody><tr>
            <Td align="right" mono>{fmt(Number(data.checking))}</Td>
            <Td align="right" mono>{fmt(Number(data.savings))}</Td>
            <Td align="right" mono>{fmt(totalDebt)}</Td>
            <Td align="right" mono>{fmt(netWorth)}</Td>
            <Td align="right" mono>{fmt(avgMonthlyIncome)}</Td>
            <Td align="right" mono>{fmt(avgMonthlySpend)}</Td>
            <Td align="right" mono>{spendRatio === null ? "—" : `${Math.round(spendRatio * 100)}%`}</Td>
          </tr></tbody>
        </Table>

        {/* Income */}
        <SectionTitle note={`This mo. ${fmt(incomeThisMonth)} · Qtr ${fmt(incomeThisQuarter)} · Year ${fmt(incomeThisYear)} · Avg/check ${fmt(avgPerCheck)}`}>Income</SectionTitle>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <Btn small color={MUTE} onClick={() => setShowAllIncome((v) => !v)}>
            {showAllIncome ? "show recent 8" : `show all ${sortedIncome.length}`}
          </Btn>
        </div>
        <Table>
          <thead><tr><Th>Date</Th><Th>Note</Th><Th align="right">Amount</Th><Th align="right"> </Th></tr></thead>
          <tbody>
            {visibleIncome.map((p) => (
              <tr key={p.id}>
                <Td mono>{p.date}</Td>
                <Td muted>{p.note || "—"}</Td>
                <Td align="right" mono>{fmt(Number(p.amount))}</Td>
                <Td align="right"><Btn small color={BRICK} onClick={() => removePaycheck(p.id)}>del</Btn></Td>
              </tr>
            ))}
            <tr>
              <Td><Input value={newPaycheck.date} onChange={(v) => setNewPaycheck({ ...newPaycheck, date: v })} placeholder="YYYY-MM-DD" width={100} /></Td>
              <Td><Input value={newPaycheck.note} onChange={(v) => setNewPaycheck({ ...newPaycheck, note: v })} placeholder="OT, on-call…" width={140} /></Td>
              <Td align="right"><Input value={newPaycheck.amount} onChange={(v) => setNewPaycheck({ ...newPaycheck, amount: v })} placeholder="0.00" type="number" width={90} onEnter={addPaycheckEntry} /></Td>
              <Td align="right">
                <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginRight: 6 }}>
                  <input type="checkbox" checked={newPaycheck.addToChecking} onChange={(e) => setNewPaycheck({ ...newPaycheck, addToChecking: e.target.checked })} /> to checking
                </label>
                <Btn small onClick={addPaycheckEntry}>add</Btn>
              </Td>
            </tr>
          </tbody>
        </Table>

        {/* Accounts */}
        <SectionTitle>Accounts</SectionTitle>
        <Table>
          <thead><tr><Th>Account</Th><Th align="right">Balance</Th><Th align="right">Amount</Th><Th align="right"> </Th></tr></thead>
          <tbody>
            <tr>
              <Td>Checking</Td>
              <Td align="right" mono>{fmt(Number(data.checking))}</Td>
              <Td align="right"><Input value={acctAmt.checking} onChange={(v) => setAcctAmt({ ...acctAmt, checking: v })} placeholder="0.00" type="number" width={90} /></Td>
              <Td align="right"><Btn small onClick={() => doAccountAdjust("checking", 1)}>+ add</Btn> <Btn small color={BRICK} onClick={() => doAccountAdjust("checking", -1)}>− sub</Btn></Td>
            </tr>
            <tr>
              <Td>Savings</Td>
              <Td align="right" mono>{fmt(Number(data.savings))}</Td>
              <Td align="right"><Input value={acctAmt.savings} onChange={(v) => setAcctAmt({ ...acctAmt, savings: v })} placeholder="0.00" type="number" width={90} /></Td>
              <Td align="right"><Btn small onClick={() => doAccountAdjust("savings", 1)}>+ add</Btn> <Btn small color={BRICK} onClick={() => doAccountAdjust("savings", -1)}>− sub</Btn></Td>
            </tr>
            <tr>
              <Td colSpan={2} muted>Transfer</Td>
              <Td align="right"><Input value={transferAmt} onChange={setTransferAmt} placeholder="0.00" type="number" width={90} /></Td>
              <Td align="right"><Btn small color={GOLD} onClick={() => doTransfer("toSavings")}>Chk → Sav</Btn> <Btn small onClick={() => doTransfer("toChecking")}>Sav → Chk</Btn></Td>
            </tr>
          </tbody>
        </Table>

        {/* Debts */}
        <SectionTitle note={`${fmt(totalDebt)} total owed · manage accounts on the Debts page`}>Debt Payments</SectionTitle>
        <Table>
          <thead><tr><Th>Account</Th><Th align="right">Balance</Th><Th align="right">Amount</Th><Th> </Th><Th> </Th></tr></thead>
          <tbody>
            {data.debts.map((d) => {
              const cfg = debtPay[d.id] || { amount: "", source: "checking" };
              const opts = sourceOptionsBase.filter((o) => o.id !== d.id);
              return (
                <tr key={d.id}>
                  <Td>{d.name}</Td>
                  <Td align="right" mono style={{ color: BRICK }}>{fmt(accrueDebt(d, todayStr()).balance)}</Td>
                  <Td align="right"><Input value={cfg.amount} onChange={(v) => setDebtPay({ ...debtPay, [d.id]: { ...cfg, amount: v } })} placeholder="0.00" type="number" width={90} /></Td>
                  <Td><Select value={cfg.source} onChange={(v) => setDebtPay({ ...debtPay, [d.id]: { ...cfg, source: v } })} options={opts} width={150} /></Td>
                  <Td align="right"><Btn small onClick={() => payDebt(d.id)}>Payment −</Btn> <Btn small color={BRICK} onClick={() => chargeDebt(d.id)}>Charge +</Btn></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {/* Log a spend */}
        <SectionTitle>Log a Spend</SectionTitle>
        <Table>
          <thead><tr><Th>Category</Th><Th align="right">Amount</Th><Th align="right"> </Th></tr></thead>
          <tbody>
            <tr>
              <Td>
                <Select
                  value={spendForm.categoryId || data.categories[0]?.id}
                  onChange={(v) => setSpendForm({ ...spendForm, categoryId: v })}
                  options={data.categories.map((c) => ({ id: c.id, label: c.name }))}
                  width={180}
                />
              </Td>
              <Td align="right"><Input value={spendForm.amount} onChange={(v) => setSpendForm({ ...spendForm, amount: v })} placeholder="0.00" type="number" width={90} onEnter={logSpend} /></Td>
              <Td align="right"><Btn small onClick={logSpend}>log</Btn></Td>
            </tr>
          </tbody>
        </Table>

        {/* Trends */}
        <SectionTitle>Trends</SectionTitle>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["day", "week", "month", "quarter", "year"].map((g) => (
              <Btn key={g} small color={granularity === g ? INK : MUTE} onClick={() => setGranularity(g)}>{g}</Btn>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {SERIES.map((s) => (
              <span key={s.key} onClick={() => toggleSeries(s.key)} style={{
                cursor: "pointer", fontFamily: MONO, fontSize: 11, padding: "4px 9px", borderRadius: RADIUS_SM,
                border: `1px solid ${s.color}`, color: activeKeys.includes(s.key) ? BG : s.color,
                background: activeKeys.includes(s.key) ? s.color : "transparent", transition: "120ms ease",
              }}>{s.label}</span>
            ))}
          </div>
        </div>
        {chartData.length < 2 || activeSeries.length === 0 ? (
          <p style={{ color: MUTE, fontSize: 12.5, fontFamily: MONO }}>{activeSeries.length === 0 ? "Pick at least one series above." : "This needs at least 2 different days of activity to draw a line — check back tomorrow."}</p>
        ) : (
          <Card><TrendChart data={chartData} activeSeries={activeSeries} /></Card>
        )}

        {/* Monthly income vs spending */}
        <SectionTitle note="from logged income, expenses & paid bills">Income vs Spending</SectionTitle>
        {monthlySummary.length === 0 ? (
          <p style={{ color: MUTE, fontSize: 12.5, fontFamily: MONO }}>Log some income or expenses to see this.</p>
        ) : (
          <Card><MonthlyBarChart data={monthlySummary} /></Card>
        )}

        {/* Recent transactions */}
        <SectionTitle note={`showing ${visibleTxns.length} of ${sortedTxns.length}`}>Recent Activity</SectionTitle>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <Btn small color={MUTE} onClick={() => setShowAllTxns((v) => !v)}>
            {showAllTxns ? "show recent 40" : `show all ${sortedTxns.length}`}
          </Btn>
        </div>
        <Table>
          <thead><tr><Th>Date</Th><Th>Type</Th><Th>Description</Th><Th align="right">Amount</Th><Th>Account</Th></tr></thead>
          <tbody>
            {visibleTxns.length === 0 && <tr><Td colSpan={5} muted>Nothing logged yet.</Td></tr>}
            {visibleTxns.map((t) => (
              <tr key={t.id}>
                <Td mono muted>{t.date}</Td>
                <Td muted style={{ textTransform: "capitalize" }}>{t.type.replace("-", " ")}</Td>
                <Td>{t.description}</Td>
                <Td align="right" mono style={{ color: t.amount < 0 ? BRICK : INK }}>{fmt(t.amount)}</Td>
                <Td muted>{t.account}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </>
        )}

        {(saveStatus === "conflict" || saveStatus === "error") && (
          <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 11, color: BRICK, textAlign: "center" }}>
            {saveStatus === "conflict"
              ? "Someone else saved a change at the same moment, so your last edit didn't go through — reloaded with the latest data. Please try again."
              : "Couldn't save your last change. Check your connection and try again."}
          </div>
        )}
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 10.5, color: MUTE, textAlign: "center" }}>
          {saveStatus === "saving" ? "Saving…" : "Synced live with your household."} <span onClick={resetToSeed} style={{ cursor: "pointer", textDecoration: "underline" }}>Reset to starting data</span>
        </div>
      </div>
    </div>
  );
}
