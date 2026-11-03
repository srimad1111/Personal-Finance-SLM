import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineAiBadge } from '../components/OfflineAiBadge';
import { useTheme } from '../theme';
import { getFinancialSummary, getCategoryWiseTotals } from '../database';
import { ChatMessage } from '../types';
import { formatINR } from '../utils/currency';

export const AiAssistantScreen: React.FC = () => {
  const { colors, borderRadius, isDark } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_01',
      sender: 'assistant',
      text: "Namaste! I am your offline Financial Copilot. All arithmetic calculations and financial summaries are computed deterministically in Indian Rupees (₹) from your local SQLite database without cloud APIs.\n\nAsk me about your total balance, UPI expenses, monthly budgets, or category breakdowns!",
      timestamp: Date.now() - 3600000,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingDotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingDotAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(typingDotAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingDotAnim.setValue(0);
    }
  }, [isTyping]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    scrollToBottom();

    try {
      const summary = await getFinancialSummary();
      const categoryTotals = await getCategoryWiseTotals('expense');
      const topExpense = categoryTotals.length > 0 ? categoryTotals[0] : null;

      let responseText = '';
      let insight: ChatMessage['financialInsight'] | undefined = undefined;
      const lower = text.toLowerCase();

      if (lower.includes('afford') || lower.includes('purchase')) {
        const canAfford = summary.netBalance > 5000;
        responseText = canAfford
          ? `Based on your deterministic SQLite ledger:\n\n• Current Net Balance: ${formatINR(summary.netBalance)}\n• Total Income: ${formatINR(summary.totalIncome)}\n• Total Expenses: ${formatINR(summary.totalExpenses)}\n\nYou have positive liquidity in Indian Rupees (₹) to accommodate minor discretionary purchases.`
          : `Based on your deterministic SQLite ledger, your current net balance is ${formatINR(summary.netBalance)}. Spending caution is advised as outflows are high.`;
        insight = {
          type: 'metric',
          title: canAfford ? 'Liquidity Verdict: POSITIVE' : 'Liquidity Verdict: CAUTION',
          value: `${formatINR(summary.netBalance)} Net Balance`,
          details: `${summary.transactionCount} total transactions evaluated in SQLite`,
        };
      } else if (lower.includes('largest') || lower.includes('highest') || lower.includes('category')) {
        if (topExpense) {
          responseText = `Your largest expense category in SQLite is ${topExpense.categoryName} with a total of ${formatINR(topExpense.totalAmount)} (${topExpense.percentage.toFixed(1)}% of all expenses across ${topExpense.transactionCount} transactions).`;
          insight = {
            type: 'breakdown',
            title: `Top Outflow Category: ${topExpense.categoryName}`,
            value: formatINR(topExpense.totalAmount),
            details: `${topExpense.percentage.toFixed(1)}% of cumulative expenses`,
          };
        } else {
          responseText = 'You have not recorded any expense transactions yet in your local database.';
        }
      } else if (lower.includes('summary') || lower.includes('how much') || lower.includes('spend')) {
        responseText = `Here is your current financial summary calculated directly from your offline SQLite ledger:\n\n• Total Income: ${formatINR(summary.totalIncome)}\n• Total Expenses: ${formatINR(summary.totalExpenses)}\n• Net Balance: ${formatINR(summary.netBalance)}\n\nCalculated across ${summary.transactionCount} verified records.`;
        insight = {
          type: 'metric',
          title: 'Ledger Summary (SQLite)',
          value: `${formatINR(summary.netBalance)} Net`,
          details: `Inflow: ${formatINR(summary.totalIncome)} | Outflow: ${formatINR(summary.totalExpenses)}`,
        };
      } else if (lower.includes('upi') || lower.includes('payment') || lower.includes('phonepe') || lower.includes('gpay')) {
        responseText = `In your localized Indian financial database, all UPI and merchant transactions (Google Pay, PhonePe, Paytm, CRED) are categorized deterministically and stored offline. Current net available liquidity is ${formatINR(summary.netBalance)}.`;
        insight = {
          type: 'metric',
          title: 'UPI & Payment Intelligence',
          value: `${formatINR(summary.netBalance)} Liquid`,
          details: 'Offline transaction categorization ready',
        };
      } else {
        responseText = `Grounded local financial insight:\n\nYour current net balance in SQLite is ${formatINR(summary.netBalance)} with total recorded expenses of ${formatINR(summary.totalExpenses)}.\n\nAll calculations are 100% offline and deterministic.`;
        insight = {
          type: 'metric',
          title: 'Offline Financial State',
          value: formatINR(summary.netBalance),
          details: `Processed across ${summary.transactionCount} records`,
        };
      }

      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now(),
          financialInsight: insight,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
        scrollToBottom();
      }, 500);
    } catch (err) {
      console.error('[AI_CHAT_ERROR]', err);
      setIsTyping(false);
    }
  };

  const suggestedQuestions = [
    'How much did I spend this month?',
    'Can I afford a ₹3,000 purchase?',
    'What is my highest expense category?',
    'Summarize my net balance in INR',
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Copilot"
        subtitle="Offline Financial Intelligence · Local SQLite"
        rightAction={<OfflineAiBadge />}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Messages Scroll View */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.userRow : styles.assistantRow,
                ]}
              >
                {!isUser && (
                  <View
                    style={[
                      styles.avatarBox,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={13} color={colors.aiAccent} />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser
                      ? {
                          backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                          borderRadius: borderRadius.md,
                        }
                      : {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderRadius: borderRadius.md,
                          borderWidth: 1,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      {
                        color: isUser
                          ? isDark
                            ? '#090D16'
                            : '#FFFFFF'
                          : colors.textPrimary,
                      },
                    ]}
                  >
                    {msg.text}
                  </Text>

                  {/* Grounded Financial Insight Card */}
                  {msg.financialInsight && (
                    <View
                      style={[
                        styles.insightBox,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.borderSubtle,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <View style={styles.insightHeader}>
                        <Ionicons name="bar-chart-outline" size={12} color={colors.aiAccent} />
                        <Text style={[styles.insightTitle, { color: colors.aiAccent }]}>
                          {msg.financialInsight.title}
                        </Text>
                      </View>
                      {msg.financialInsight.value && (
                        <Text style={[styles.insightValue, { color: colors.textPrimary }]}>
                          {msg.financialInsight.value}
                        </Text>
                      )}
                      {msg.financialInsight.details && (
                        <Text style={[styles.insightDetails, { color: colors.textSecondary }]}>
                          {msg.financialInsight.details}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View style={[styles.messageRow, styles.assistantRow]}>
              <View
                style={[
                  styles.avatarBox,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={13} color={colors.aiAccent} />
              </View>
              <View
                style={[
                  styles.typingBubble,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={[styles.typingText, { color: colors.textMuted }]}>
                  Computing from SQLite ledger...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggested Quick Prompt Chips */}
        <View style={styles.suggestedWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedScroll}
          >
            {suggestedQuestions.map((q, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.suggestedChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ]}
                onPress={() => handleSendMessage(q)}
              >
                <Text style={[styles.suggestedChipText, { color: colors.textSecondary }]}>
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chat Input Bar */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.inputField,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: borderRadius.md,
              },
            ]}
            placeholder="Ask about expenses, budgets, liquidity..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendMessage()}
            returnKeyType="send"
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                borderRadius: borderRadius.md,
                opacity: inputText.trim().length > 0 ? 1 : 0.4,
              },
            ]}
            disabled={inputText.trim().length === 0}
            onPress={() => handleSendMessage()}
            accessibilityLabel="Send message"
          >
            <Ionicons
              name="arrow-up"
              size={17}
              color={isDark ? '#090D16' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatarBox: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 8,
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  insightBox: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  insightValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  insightDetails: {
    fontSize: 11,
  },
  typingBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  suggestedWrapper: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  suggestedScroll: {
    paddingHorizontal: 18,
    gap: 6,
  },
  suggestedChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  suggestedChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
  },
  inputField: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    fontSize: 13,
    borderWidth: 1,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
