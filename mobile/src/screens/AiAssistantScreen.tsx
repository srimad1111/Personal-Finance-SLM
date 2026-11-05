import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Header } from '../components/Header';
import { OfflineAiBadge } from '../components/OfflineAiBadge';
import { useTheme } from '../theme';
import { ChatMessage } from '../types';
import {
  checkModelStatus,
  importModelFromUri,
  runOfflineQueryInference,
  ModelStatus,
  MODEL_FILENAME,
} from '../services/llamaService';

export const AiAssistantScreen: React.FC = () => {
  const { colors, borderRadius, isDark } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_01',
      sender: 'assistant',
      text: "Namaste! I am your offline Financial Copilot. All calculations and financial summaries are computed deterministically in Indian Rupees (₹) from your local SQLite database without cloud APIs.\n\nAsk me about your total expenses, balance, category spending, or budgets!",
      timestamp: Date.now() - 3600000,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingDotAnim = useRef(new Animated.Value(0)).current;

  const refreshModelStatus = useCallback(async () => {
    try {
      const status = await checkModelStatus();
      setModelStatus(status);
    } catch (err) {
      console.warn('[AI_SCREEN] Error reading model status:', err);
    }
  }, []);

  useEffect(() => {
    refreshModelStatus();
  }, [refreshModelStatus]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 120);
      }
    );
    return () => {
      showSub.remove();
    };
  }, []);

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

  const handleImportModel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setIsImporting(true);
        setImportProgress(0.2);

        await importModelFromUri(file.uri, (prog) => {
          setImportProgress(prog);
        });

        await refreshModelStatus();
        setIsImporting(false);
        setImportProgress(0);

        setMessages((prev) => [
          ...prev,
          {
            id: `msg_import_${Date.now()}`,
            sender: 'assistant',
            text: `Successfully imported ${MODEL_FILENAME} into application sandbox! On-device Gemma 3 1B SLM inference is now active.`,
            timestamp: Date.now(),
            financialInsight: {
              type: 'metric',
              title: 'Model Ready (Offline)',
              value: 'Gemma 3 1B Active',
              details: 'Running locally via llama.cpp',
            },
          },
        ]);
        scrollToBottom();
      }
    } catch (err) {
      console.error('[AI_SCREEN] Error importing model:', err);
      setIsImporting(false);
      alert('Failed to import GGUF file. Please ensure the file is accessible.');
    }
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
      // Execute offline query understanding via Gemma 3 1B SLM + SQLite
      const response = await runOfflineQueryInference(text);

      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          sender: 'assistant',
          text: response.text,
          timestamp: Date.now(),
          financialInsight: response.insight,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
        scrollToBottom();
      }, 400);
    } catch (err) {
      console.error('[AI_CHAT_ERROR]', err);
      setIsTyping(false);
    }
  };

  const suggestedQuestions = [
    'How much did I spend this month?',
    'What is my highest expense category?',
    'Show my monthly budget status',
    'Summarize my net savings in INR',
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Copilot"
        subtitle="Offline Financial Intelligence · Local SQLite"
        rightAction={
          <OfflineAiBadge
            modelName={
              modelStatus?.available
                ? `Gemma 3 1B (${modelStatus.sizeFormatted || 'Ready'})`
                : 'SLM Ready'
            }
          />
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Model Import Banner (if model is not yet loaded in private sandbox) */}
        {!modelStatus?.available && (
          <View
            style={[
              styles.modelImportBanner,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <View style={styles.bannerIconBox}>
              <Ionicons name="hardware-chip-outline" size={18} color={colors.aiAccent} />
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>
                Gemma 3 1B Local Model
              </Text>
              <Text style={[styles.bannerSub, { color: colors.textMuted }]}>
                {isImporting
                  ? `Copying model to app storage (${(importProgress * 100).toFixed(0)}%)...`
                  : 'Place your Q4_K_M GGUF file in sandbox to run offline llama.cpp inference.'}
              </Text>
            </View>

            {isImporting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <TouchableOpacity
                style={[
                  styles.importButton,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                    borderRadius: borderRadius.sm,
                  },
                ]}
                onPress={handleImportModel}
              >
                <Ionicons
                  name="download-outline"
                  size={13}
                  color={isDark ? '#090D16' : '#FFFFFF'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.importBtnText,
                    { color: isDark ? '#090D16' : '#FFFFFF' },
                  ]}
                >
                  Import
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

        {/* Bottom Composer Region */}
        <View style={styles.composerWrapper}>
          {/* Suggested Quick Prompt Chips */}
          <View style={styles.suggestedWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedScroll}
              keyboardShouldPersistTaps="handled"
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
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  composerWrapper: {
    width: '100%',
  },
  modelImportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    padding: 10,
    borderWidth: 1,
  },
  bannerIconBox: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  bannerSub: {
    fontSize: 10,
    marginTop: 1,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  importBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
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
