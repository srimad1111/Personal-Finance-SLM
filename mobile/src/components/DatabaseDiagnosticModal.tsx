import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { runDatabaseTests } from '../database/databaseTests';
import { DbTestSuiteReport } from '../types/database';
import { useTheme } from '../theme';

interface DatabaseDiagnosticModalProps {
  visible: boolean;
  onClose: () => void;
  onDatabaseChanged?: () => void;
}

export const DatabaseDiagnosticModal: React.FC<DatabaseDiagnosticModalProps> = ({
  visible,
  onClose,
  onDatabaseChanged,
}) => {
  const { colors, borderRadius, isDark } = useTheme();

  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<DbTestSuiteReport | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const result = await runDatabaseTests();
      setReport(result);
      if (onDatabaseChanged) {
        onDatabaseChanged();
      }
    } catch (err) {
      console.error('[DB_TEST_RUNNER_ERROR]', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                SQLite Diagnostics & Integrity
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Validates local offline persistence & ACID compliance
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Test Status Banner */}
          {report && (
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: report.failed === 0 ? colors.successLight : colors.dangerLight,
                  borderColor: report.failed === 0 ? `${colors.success}30` : `${colors.danger}30`,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <Ionicons
                  name={report.failed === 0 ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={report.failed === 0 ? colors.success : colors.danger}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.summaryText,
                    { color: report.failed === 0 ? colors.success : colors.danger },
                  ]}
                >
                  {report.failed === 0
                    ? `All ${report.total} tests passed (${report.durationMs}ms)`
                    : `${report.failed} failed out of ${report.total} tests`}
                </Text>
              </View>
            </View>
          )}

          {/* Test List */}
          <ScrollView
            style={styles.testList}
            contentContainerStyle={{ paddingVertical: 6 }}
            showsVerticalScrollIndicator={false}
          >
            {!report && !isRunning && (
              <View style={styles.emptyPrompt}>
                <Ionicons name="shield-checkmark-outline" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyPromptTitle, { color: colors.textPrimary }]}>
                  Database Operations Ready
                </Text>
                <Text style={[styles.emptyPromptSub, { color: colors.textMuted }]}>
                  Run the diagnostic suite to test schema integrity, CRUD, aggregation, and atomic rollback.
                </Text>
              </View>
            )}

            {isRunning && (
              <View style={styles.runningContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.runningText, { color: colors.textSecondary }]}>
                  Executing parameterized SQLite tests...
                </Text>
              </View>
            )}

            {report?.results.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.testItemRow,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: r.passed ? colors.borderSubtle : colors.danger,
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Ionicons
                  name={r.passed ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={r.passed ? colors.success : colors.danger}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.testName,
                      { color: r.passed ? colors.textPrimary : colors.danger },
                    ]}
                  >
                    {r.test}
                  </Text>
                  {r.details && (
                    <Text style={[styles.testError, { color: colors.danger }]}>
                      {r.details}
                    </Text>
                  )}
                </View>
                <Text style={[styles.testDuration, { color: colors.textMuted }]}>
                  {r.durationMs}ms
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.footerActions}>
            <Button
              title={isRunning ? 'Executing Tests...' : 'Run SQLite Diagnostic'}
              icon="play-outline"
              loading={isRunning}
              variant="primary"
              size="md"
              onPress={handleRunTests}
            />
            <Button
              title="Close"
              variant="ghost"
              size="sm"
              onPress={onClose}
              style={{ marginTop: 6 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    padding: 18,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  summaryCard: {
    padding: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testList: {
    maxHeight: 280,
  },
  emptyPrompt: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyPromptTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  emptyPromptSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  runningContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  runningText: {
    fontSize: 12,
  },
  testItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    marginBottom: 5,
  },
  testName: {
    fontSize: 12,
    fontWeight: '500',
  },
  testError: {
    fontSize: 10,
    marginTop: 2,
  },
  testDuration: {
    fontSize: 10,
  },
  footerActions: {
    marginTop: 12,
  },
});
