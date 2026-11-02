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
import { StatusBadge } from './StatusBadge';
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
  const { colors, borderRadius } = useTheme();

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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                SQLite Diagnostics & Test Suite
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Validates local offline persistence & integrity
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Test Status Banner */}
          {report && (
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: report.failed === 0 ? colors.successLight : colors.dangerLight,
                  borderColor: report.failed === 0 ? colors.success : colors.danger,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <Ionicons
                  name={report.failed === 0 ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={report.failed === 0 ? colors.success : colors.danger}
                />
                <Text
                  style={[
                    styles.summaryText,
                    { color: report.failed === 0 ? colors.success : colors.danger },
                  ]}
                >
                  {report.failed === 0
                    ? `All ${report.total} Database Tests Passed (${report.durationMs}ms)`
                    : `${report.failed} Failed out of ${report.total} tests`}
                </Text>
              </View>
            </View>
          )}

          {/* Test List */}
          <ScrollView
            style={styles.testList}
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {!report && !isRunning && (
              <View style={styles.emptyPrompt}>
                <Ionicons name="hardware-chip-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyPromptTitle, { color: colors.textPrimary }]}>
                  Database Operations Ready
                </Text>
                <Text style={[styles.emptyPromptSub, { color: colors.textMuted }]}>
                  Click below to execute all 13 automated tests against the local SQLite database.
                </Text>
              </View>
            )}

            {isRunning && (
              <View style={styles.runningContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.runningText, { color: colors.textPrimary }]}>
                  Executing parameterized SQL tests...
                </Text>
              </View>
            )}

            {report?.results.map((r, i) => (
              <Card
                key={i}
                style={[
                  styles.testCard,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: r.passed ? colors.borderSubtle : colors.danger,
                  },
                ]}
              >
                <View style={styles.testRow}>
                  <Ionicons
                    name={r.passed ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={r.passed ? colors.success : colors.danger}
                    style={{ marginRight: 10 }}
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
              </Card>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.footerActions}>
            <Button
              title={isRunning ? 'Running Tests...' : 'Run SQLite Test Suite'}
              icon="play-outline"
              loading={isRunning}
              onPress={handleRunTests}
            />
            <Button
              title="Close Diagnostics"
              variant="ghost"
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
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  summaryCard: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  testList: {
    maxHeight: 320,
    marginVertical: 4,
  },
  emptyPrompt: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyPromptSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  runningContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  runningText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  testCard: {
    marginVertical: 3,
    padding: 10,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testName: {
    fontSize: 12,
    fontWeight: '600',
  },
  testError: {
    fontSize: 11,
    marginTop: 2,
  },
  testDuration: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 8,
  },
  footerActions: {
    marginTop: 10,
  },
});

