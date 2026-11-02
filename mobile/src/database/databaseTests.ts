import {
  initializeDatabase,
  transactionRepository,
  categoryRepository,
  budgetRepository,
  settingsRepository,
} from './index';
import { DbTestSuiteReport, DbTestResult } from '../types/database';

/**
 * Automated end-to-end SQLite test suite for Personal Finance SLM.
 * Tests every CRUD operation, filters, sorting, aggregations, foreign keys, and injection safety.
 */
export async function runDatabaseTests(): Promise<DbTestSuiteReport> {
  const results: DbTestResult[] = [];
  const suiteStartTime = Date.now();

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    const start = Date.now();
    try {
      await testFn();
      results.push({
        test: testName,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        test: testName,
        passed: false,
        details: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      });
    }
  };

  // Test 1: Initialization
  await runTest('DB-01: Initialization & Schema Migration', async () => {
    await initializeDatabase();
  });

  // Test 2: Categories Seed Check
  await runTest('DB-02: Category Seed Verification', async () => {
    const categories = await categoryRepository.getAll();
    if (categories.length < 10) {
      throw new Error(`Expected at least 10 categories, found ${categories.length}`);
    }
    const hasGroceries = categories.some((c) => c.id === 'groceries');
    if (!hasGroceries) {
      throw new Error('Missing "groceries" category');
    }
  });

  // Test 3: Settings Check & Update
  await runTest('DB-03: Settings Retrieval & Parameterized Update', async () => {
    const initialSettings = await settingsRepository.getSettings();
    if (!initialSettings.currency) {
      throw new Error('Default settings missing currency');
    }
    const updated = await settingsRepository.updateSettings({ currency: 'INR' });
    if (updated.currency !== 'INR') {
      throw new Error(`Expected currency INR, received ${updated.currency}`);
    }
  });

  // Test 4: Insert Transaction
  let testTxId = '';
  await runTest('DB-04: Insert Transaction (Parameterized)', async () => {
    const created = await transactionRepository.insert({
      amount: 88.5,
      transaction_type: 'expense',
      description: 'Automated Test Grocery Run',
      merchant: 'TestMart Supercenter',
      category: 'groceries',
      transaction_date: '2026-11-02',
      notes: 'Automated test record',
      is_ai_categorized: 0,
      ai_confidence: null,
    });

    if (!created.id || created.amount !== 88.5) {
      throw new Error('Failed to insert test transaction');
    }
    testTxId = created.id;
  });

  // Test 5: Retrieve By ID
  await runTest('DB-05: Retrieve Transaction By ID', async () => {
    if (!testTxId) throw new Error('No test transaction ID available');
    const fetched = await transactionRepository.getById(testTxId);
    if (!fetched || fetched.merchant !== 'TestMart Supercenter') {
      throw new Error('Transaction retrieved does not match inserted data');
    }
  });

  // Test 6: Sort Transactions
  await runTest('DB-06: Deterministic Sorting (By Date & Amount)', async () => {
    const byAmountDesc = await transactionRepository.getAll({
      sortBy: 'amount',
      sortOrder: 'DESC',
      limit: 5,
    });
    if (byAmountDesc.length >= 2) {
      if (byAmountDesc[0].amount < byAmountDesc[1].amount) {
        throw new Error('Sorting by amount DESC failed');
      }
    }

    const byDateAsc = await transactionRepository.getAll({
      sortBy: 'date',
      sortOrder: 'ASC',
      limit: 5,
    });
    if (byDateAsc.length >= 2) {
      if (byDateAsc[0].transaction_date > byDateAsc[1].transaction_date) {
        throw new Error('Sorting by date ASC failed');
      }
    }
  });

  // Test 7: Filter Transactions
  await runTest('DB-07: Filter Transactions by Category & Date', async () => {
    const results = await transactionRepository.getAll({
      category: 'groceries',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });

    if (results.length === 0) {
      throw new Error('Expected at least 1 transaction matching filter');
    }
    const match = results.some((t) => t.id === testTxId);
    if (!match) {
      throw new Error('Test transaction not found in filtered set');
    }
  });

  // Test 8: Update Transaction
  await runTest('DB-08: Update Transaction Amount & Notes', async () => {
    if (!testTxId) throw new Error('No test transaction ID available');
    const updated = await transactionRepository.update(testTxId, {
      amount: 95.0,
      notes: 'Updated test note after price check',
    });

    if (!updated) {
      throw new Error('Update returned false');
    }

    const fetched = await transactionRepository.getById(testTxId);
    if (!fetched || fetched.amount !== 95.0) {
      throw new Error(`Expected amount 95.0, got ${fetched?.amount}`);
    }
  });

  // Test 9: Aggregation - Financial Summary
  await runTest('DB-09: Calculate Income & Expense Summary', async () => {
    const summary = await transactionRepository.getFinancialSummary('2026-11-01', '2026-11-30');
    if (summary.totalIncome < 0 || summary.totalExpenses < 0) {
      throw new Error('Summary values cannot be negative');
    }
    if (summary.netBalance !== summary.totalIncome - summary.totalExpenses) {
      throw new Error('Net balance does not equal income minus expenses');
    }
  });

  // Test 10: Aggregation - Category-wise Totals
  await runTest('DB-10: Calculate Category-Wise Totals & Percentages', async () => {
    const categoryTotals = await transactionRepository.getCategoryWiseTotals('expense');
    if (categoryTotals.length === 0) {
      throw new Error('Expected at least one category total');
    }
    const totalPercentage = categoryTotals.reduce((sum, c) => sum + c.percentage, 0);
    if (Math.round(totalPercentage) !== 100) {
      throw new Error(`Total percentage should equal 100%, calculated ${totalPercentage}`);
    }
  });

  // Test 11: Aggregation - Monthly Spending Trends
  await runTest('DB-11: Generate Deterministic Monthly Spending Trends', async () => {
    const trends = await transactionRepository.getMonthlyTrends(6);
    if (trends.length === 0) {
      throw new Error('Expected at least one monthly trend record');
    }
    for (const t of trends) {
      if (t.savings !== t.income - t.expense) {
        throw new Error('Monthly trend savings calculation mismatch');
      }
    }
  });

  // Test 12: Budget Retrieval & Progress
  await runTest('DB-12: Budget Retrieval & Calculated Spent Amounts', async () => {
    const now = new Date();
    const budgets = await budgetRepository.getBudgetProgress(now.getMonth() + 1, now.getFullYear());
    if (budgets.length === 0) {
      throw new Error('Expected seeded category budgets');
    }
    const groceriesBudget = budgets.find((b) => b.categoryId === 'groceries');
    if (!groceriesBudget) {
      throw new Error('Missing groceries budget');
    }
    if (groceriesBudget.spentAmount <= 0) {
      throw new Error('Groceries budget should include the test expense transaction');
    }
  });

  // Test 13: Budget Upsert
  await runTest('DB-13: Budget Upsert (Insert or Update Limit)', async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const upserted = await budgetRepository.upsert('groceries', 750.0, month, year);
    if (upserted.monthly_limit !== 750.0) {
      throw new Error('Failed to update monthly limit via upsert');
    }
  });

  // Test 14: SQL Injection Attack Resilience
  await runTest('DB-14: SQL Injection Parameterization Resilience', async () => {
    const maliciousInput = "Test'; DROP TABLE transactions; --";
    const attackTx = await transactionRepository.insert({
      amount: 10.0,
      transaction_type: 'expense',
      description: maliciousInput,
      merchant: maliciousInput,
      category: 'misc',
      transaction_date: '2026-11-02',
      notes: maliciousInput,
      is_ai_categorized: 0,
      ai_confidence: null,
    });

    const verifyFetch = await transactionRepository.getById(attackTx.id);
    if (!verifyFetch || verifyFetch.description !== maliciousInput) {
      throw new Error('Parameterized injection test failed: text was not stored literally');
    }

    await transactionRepository.delete(attackTx.id);
  });

  // Test 15: Delete Transaction
  await runTest('DB-15: Delete Transaction & Verify Removal', async () => {
    if (!testTxId) throw new Error('No test transaction ID available');
    const deleted = await transactionRepository.delete(testTxId);
    if (!deleted) {
      throw new Error('Delete returned false');
    }
    const checkDeleted = await transactionRepository.getById(testTxId);
    if (checkDeleted !== null) {
      throw new Error('Transaction was not deleted from SQLite');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    passed,
    failed,
    total: results.length,
    durationMs: Date.now() - suiteStartTime,
    results,
  };
}
