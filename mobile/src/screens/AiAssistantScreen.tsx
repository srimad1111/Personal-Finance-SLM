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
import { Card } from '../components/Card';
import { OfflineAiBadge } from '../components/OfflineAiBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme';
import {
  INITIAL_AI_CHAT,
  SUGGESTED_QUESTIONS,
} from '../data/mockData';
import { ChatMessage } from '../types';

export const AiAssistantScreen: React.FC = () => {
  const { colors, borderRadius } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_AI_CHAT);
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

  const handleSendMessage = (textToSend?: string) => {
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

    // Simulate on-device SLM inference latency (500ms - 800ms) with grounded financial answers
    setTimeout(() => {
      let responseText = '';
      let insight: ChatMessage['financialInsight'] | undefined = undefined;
      const lower = text.toLowerCase();

      if (lower.includes('afford') || lower.includes('$250') || lower.includes('purchase')) {
        responseText =
          'Yes, you can comfortably afford this $250 purchase.\n\n• Your projected monthly savings are $2,980.56.\n• Safe unallocated discretionary funds: $1,730.56.\n\nThis will reduce your November savings rate from 65.2% to 61.7%.';
        insight = {
          type: 'metric',
          title: 'Affordability Verdict: SAFE',
          value: '$1,730.56 Cushion',
          details: 'Will not breach your $4,200 total monthly spending cap.',
        };
      } else if (lower.includes('spend this week') || lower.includes('largest expense')) {
        responseText =
          'Your largest expense category this month is Housing & Rent ($1,850.00), representing 74.9% of your outflows.\n\nSecond largest: Shopping at $219.00 (Apple Store Online) followed by Groceries at $142.35 (Whole Foods Market).';
        insight = {
          type: 'breakdown',
          title: 'Largest Outflow',
          value: '$1,850.00',
          details: 'Housing & Rent (74.9% of total)',
        };
      } else if (lower.includes('subscription') || lower.includes('recurring')) {
        responseText =
          'I detected 2 recurring subscription charges in your local SQLite logs:\n\n1. Netflix & Spotify Bundle: $22.99 / month\n2. ConEdison Utility: ~$89.20 / month\n\nAnnual subscription run rate: $275.88.';
        insight = {
          type: 'alert',
          title: 'Active Subscriptions',
          value: '$22.99 / mo',
          details: 'Digital media services account for ~1% of spending.',
        };
      } else {
        responseText = `Based on your on-device transaction ledger, your current balance is $4,630.56 with $2,469.44 total monthly expenses.\n\nAll data is processed strictly locally with zero external network calls.`;
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
    }, 700);
  };

  const handleClearConversation = () => {
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        sender: 'assistant',
        text: "Conversation cleared. Memory reset to your active SQLite local ledger.\n\nWhat would you like to review or ask about your finances?",
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="AI Assistant"
        subtitle="On-Device Small Language Model"
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
        <OfflineAiBadge modelName="Llama-3.2-1B-Finance (Local GGUF)" />
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
                    <Ionicons name="sparkles" size={15} color={colors.aiAccentGlow} />
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

                  {/* Suggested Action Chips */}
                  {msg.suggestedActions && (
                    <View style={styles.actionsContainer}>
                      {msg.suggestedActions.map((action, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.actionChip,
                            {
                              backgroundColor: colors.surfaceElevated,
                              borderColor: colors.border,
                              borderRadius: borderRadius.full,
                            },
                          ]}
                          onPress={() => handleSendMessage(action)}
                        >
                          <Text style={[styles.actionChipText, { color: colors.accentLight }]}>
                            {action} →
                          </Text>
                        </TouchableOpacity>
                      ))}
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
                <Ionicons name="sparkles" size={14} color={colors.aiAccentGlow} />
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
                <View style={styles.typingDotsRow}>
                  <Text style={[styles.typingText, { color: colors.textMuted }]}>
                    SLM evaluating local SQLite ledger...
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggested Quick Prompt Chips */}
        <View style={styles.suggestedWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
            {SUGGESTED_QUESTIONS.map((q, idx) => (
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
            placeholder="Ask about spending, budgets, savings..."
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
  actionsContainer: {
    marginTop: 10,
    gap: 6,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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

