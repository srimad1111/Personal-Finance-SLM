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

export const AiAssistantScreen: React.FC = () => {
  const { colors, borderRadius } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_01',
      sender: 'assistant',
      text: "Hello! I am your offline Financial Assistant. All arithmetic calculations and financial summaries are computed deterministically from your local SQLite database without cloud APIs.\n\nAsk me about your total balance, monthly spending, or category breakdowns!",
      timestamp: Date.now() - 3600000,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingDotAnim = useRef(new Animated.Value(0)).current;

  // Typing dots animation
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
      // Deterministic calculations directly from SQLite
      const summary = await getFinancialSummary();
      const categoryTotals = await getCategoryWiseTotals('expense');
      const topExpense = categoryTotals.length > 0 ? categoryTotals[0] : null;

      let responseText = '';
      let insight: ChatMessage['financialInsight'] | undefined = undefined;
      const lower = text.toLowerCase();

      if (lower.includes('afford') || lower.includes('purchase')) {
        const canAfford = summary.netBalance > 200;
        responseText = canAfford
          ? `Based on your deterministic SQLite ledger:\n\n• Current Net Balance: $${summary.netBalance.toFixed(2)}\n• Total Income: $${summary.totalIncome.toFixed(2)}\n• Total Expenses: $${summary.totalExpenses.toFixed(2)}\n\nYou have positive liquidity to accommodate minor discretionary purchases.`
          : `Based on your deterministic SQLite ledger, your current net balance is $${summary.netBalance.toFixed(2)}. Spending caution is advised as outflows are high.`;
        insight = {
          type: 'metric',
          title: canAfford ? 'Liquidity Verdict: POSITIVE' : 'Liquidity Verdict: CAUTION',
          value: `$${summary.netBalance.toFixed(2)} Net Balance`,
          details: `${summary.transactionCount} total transactions evaluated in SQLite`,
        };
      } else if (lower.includes('largest') || lower.includes('highest') || lower.includes('category')) {
        if (topExpense) {
          responseText = `Your largest expense category in SQLite is ${topExpense.categoryName} with a total of $${topExpense.totalAmount.toFixed(2)} (${topExpense.percentage.toFixed(1)}% of all expenses across ${topExpense.transactionCount} transactions).`;
          insight = {
            type: 'breakdown',
            title: 'Top Outflow Category',
            value: `$${topExpense.totalAmount.toFixed(2)}`,
            details: `${topExpense.categoryName} (${topExpense.percentage.toFixed(1)}% of total)`,
          };
        } else {
          responseText = 'You have no recorded expense transactions in SQLite yet.';
        }
      } else {
        responseText = `Local SQLite Deterministic Summary:\n\n• Total Income: +$${summary.totalIncome.toFixed(2)}\n• Total Outflows: -$${summary.totalExpenses.toFixed(2)}\n• Net Balance: $${summary.netBalance.toFixed(2)}\n• Transactions Logged: ${summary.transactionCount}\n\nAll math is calculated deterministically with zero cloud transmission.`;
        insight = {
          type: 'metric',
          title: 'Deterministic Balance',
          value: `$${summary.netBalance.toFixed(2)}`,
          details: `Computed from ${summary.transactionCount} SQLite records`,
        };
      }

      const assistantMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: Date.now(),
        financialInsight: insight,
      };

      setIsTyping(false);
      setMessages((prev) => [...prev, assistantMsg]);
      scrollToBottom();
    } catch (err) {
      console.error('[AI_ASSISTANT_QUERY_ERROR]', err);
      setIsTyping(false);
    }
  };

  const handleClearConversation = () => {
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        sender: 'assistant',
        text: "Conversation cleared. Memory reset to your active SQLite local ledger.\n\nWhat would you like to review about your finances?",
        timestamp: Date.now(),
      },
    ]);
  };

  const suggestedQuestions = [
    'What is my total net balance?',
    'What is my largest expense category?',
    'Can I afford a discretionary purchase?',
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Finance Assistant"
        subtitle="Deterministic Local Ledger Engine"
        rightAction={
          <TouchableOpacity
            style={[
              styles.clearButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
            onPress={handleClearConversation}
            accessibilityLabel="Clear Conversation"
          >
            <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        }
      />

      {/* Offline Status Badge Banner */}
      <View style={styles.statusBarWrapper}>
        <OfflineAiBadge modelName="Offline Deterministic Engine (SQLite)" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Messages List */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesScroll}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
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
                      styles.avatarCircle,
                      {
                        backgroundColor: colors.aiAccentLight,
                        borderColor: colors.aiAccent,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                  >
                    <Ionicons name="calculator-outline" size={15} color={colors.aiAccentGlow} />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser
                      ? {
                          backgroundColor: colors.accent,
                          borderBottomRightRadius: 4,
                          borderTopLeftRadius: borderRadius.lg,
                          borderTopRightRadius: borderRadius.lg,
                          borderBottomLeftRadius: borderRadius.lg,
                        }
                      : {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderBottomLeftRadius: 4,
                          borderTopLeftRadius: borderRadius.lg,
                          borderTopRightRadius: borderRadius.lg,
                          borderBottomRightRadius: borderRadius.lg,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      { color: isUser ? '#FFFFFF' : colors.textPrimary },
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
                          borderRadius: borderRadius.md,
                        },
                      ]}
                    >
                      <View style={styles.insightHeader}>
                        <Ionicons name="analytics" size={13} color={colors.aiAccentGlow} />
                        <Text style={[styles.insightTitle, { color: colors.aiAccentGlow }]}>
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
                  styles.avatarCircle,
                  {
                    backgroundColor: colors.aiAccentLight,
                    borderColor: colors.aiAccent,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Ionicons name="calculator-outline" size={14} color={colors.aiAccentGlow} />
              </View>
              <View
                style={[
                  styles.typingBubble,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: borderRadius.lg,
                  },
                ]}
              >
                <Text style={[styles.typingText, { color: colors.textMuted }]}>
                  Evaluating local SQLite ledger...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggested Quick Prompt Chips */}
        <View style={styles.suggestedWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
            {suggestedQuestions.map((q, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.suggestedChip,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
                onPress={() => handleSendMessage(q)}
              >
                <Text style={[styles.suggestedChipText, { color: colors.textSecondary }]}>{q}</Text>
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
                borderRadius: borderRadius.full,
              },
            ]}
            placeholder="Ask about spending, balance, categories..."
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
                backgroundColor: inputText.trim() ? colors.aiAccent : colors.chipBackground,
                borderRadius: borderRadius.full,
              },
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={inputText.trim() ? '#FFFFFF' : colors.textMuted}
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
  clearButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  statusBarWrapper: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  messagesScroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    maxWidth: '86%',
  },
  userRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  insightBox: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },
  insightDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  typingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  suggestedWrapper: {
    paddingVertical: 6,
  },
  suggestedScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestedChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  suggestedChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputField: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
