/**
 * Dedicated Local Gemma 3 Model Testing Screen
 *
 * Provides a complete manual test bench for:
 * 1. Persistent model storage (SAF import, replace, delete)
 * 2. Native llama.cpp lifecycle (load model, release context)
 * 3. Token-by-token streaming inference with cancellation
 * 4. Hardware and runtime platform verification
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { useTheme } from '../theme';
import { MainTabType } from '../types';
import {
  getModelPath,
  getModelInfo,
  importModel,
  deleteImportedModel,
  cleanupAbandonedTempFiles,
  ModelStorageInfo,
} from '../services/modelStorageService';
import {
  LlamaService,
  formatGemma3Instruction,
  ModelLifecycleState,
} from '../services/llamaService';

interface LocalModelTestScreenProps {
  onNavigate: (tab: MainTabType) => void;
}

interface TestMessage {
  id: string;
  sender: 'user' | 'model';
  text: string;
  timestamp: number;
  durationMs?: number;
}

export const LocalModelTestScreen: React.FC<LocalModelTestScreenProps> = ({ onNavigate }) => {
  const { colors, borderRadius, isDark } = useTheme();

  // Storage and model metadata state
  const [modelInfo, setModelInfo] = useState<ModelStorageInfo | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Inference context lifecycle state
  const [inferenceStatus, setInferenceStatus] = useState<ModelLifecycleState>('unloaded');
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Inference generation state
  const [promptText, setPromptText] = useState(
    'Explain what a monthly budget is in simple language.'
  );
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const generationStartTimeRef = useRef<number>(0);

  // Sync service status
  const refreshStorageAndInferenceStatus = useCallback(async () => {
    try {
      setIsStorageLoading(true);
      const info = await getModelInfo();
      setModelInfo(info);

      const llamaStatus = LlamaService.getInstance().getModelStatus();
      setInferenceStatus(llamaStatus.state);
      if (llamaStatus.error) {
        setGeneralError(llamaStatus.error);
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    // Startup: clean any abandoned temporary import files and refresh status
    cleanupAbandonedTempFiles().then(() => {
      refreshStorageAndInferenceStatus();
    });
  }, [refreshStorageAndInferenceStatus]);

  // Confirmation dialog helper (web and mobile compatible)
  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  // ----------------------------------------------------------------------------
  // SECTION B: Storage Actions (Import, Replace, Delete)
  // ----------------------------------------------------------------------------

  const handleImportModel = async (allowOverwrite = false) => {
    try {
      setIsImporting(true);
      setImportProgress(0.05);
      setGeneralError(null);

      const result = await importModel(undefined, {
        allowOverwrite,
        onProgress: (p) => setImportProgress(p),
      });

      if (result.canceled) {
        setIsImporting(false);
        setImportProgress(0);
        return;
      }

      if (!result.success) {
        setGeneralError(result.error || 'Import failed.');
      } else {
        await refreshStorageAndInferenceStatus();
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleReplaceModel = () => {
    confirmAction(
      'Replace Model',
      'Are you sure you want to replace the current GGUF model? You will select a new file from your device.',
      () => handleImportModel(true)
    );
  };

  const handleDeleteModel = () => {
    confirmAction(
      'Delete Model',
      'Are you sure you want to delete the imported GGUF model from persistent application storage?',
      async () => {
        try {
          if (inferenceStatus === 'ready' || inferenceStatus === 'generating') {
            await LlamaService.getInstance().releaseModel();
            setInferenceStatus('unloaded');
          }
          await deleteImportedModel();
          await refreshStorageAndInferenceStatus();
        } catch (err) {
          setGeneralError(err instanceof Error ? err.message : String(err));
        }
      }
    );
  };

  // ----------------------------------------------------------------------------
  // SECTION C: Model Load & Release Actions
  // ----------------------------------------------------------------------------

  const handleLoadModel = async () => {
    if (!modelInfo?.isImported) {
      setGeneralError('Please import a GGUF model before loading.');
      return;
    }

    try {
      setIsLoadingModel(true);
      setLoadProgress(0.1);
      setGeneralError(null);
      setInferenceStatus('loading');

      const path = getModelPath();
      await LlamaService.getInstance().initializeModel(path, {
        contextSize: 2048,
        threadCount: 4,
        useMmap: true,
        onProgress: (prog) => {
          setLoadProgress(prog);
        },
      });

      setInferenceStatus('ready');
      setLoadProgress(1.0);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setGeneralError(`Initialization failed: ${errMsg}`);
      setInferenceStatus('error');
    } finally {
      setIsLoadingModel(false);
      setLoadProgress(0);
    }
  };

  const handleReleaseModel = async () => {
    try {
      await LlamaService.getInstance().releaseModel();
      setInferenceStatus('unloaded');
      setGeneralError(null);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : String(err));
    }
  };

  // ----------------------------------------------------------------------------
  // SECTION D: Test Inference & Streaming
  // ----------------------------------------------------------------------------

  const handleSendPrompt = async () => {
    const trimmed = promptText.trim();
    if (!trimmed || isGenerating) return;

    if (inferenceStatus !== 'ready') {
      setGeneralError('Model is not initialized. Press "Load Model" first.');
      return;
    }

    const userMsg: TestMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setStreamingText('');
    setIsGenerating(true);
    setGeneralError(null);
    generationStartTimeRef.current = Date.now();

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);

    try {
      const formattedPrompt = formatGemma3Instruction(
        'General Financial Knowledge & Advice',
        trimmed
      );

      const completeText = await LlamaService.getInstance().generateResponse(
        formattedPrompt,
        {
          onToken: (_token, accumulated) => {
            setStreamingText(accumulated);
            scrollViewRef.current?.scrollToEnd({ animated: false });
          },
        },
        {
          maxTokens: 256,
          temperature: 0.1,
          topP: 0.95,
        }
      );

      const elapsed = Date.now() - generationStartTimeRef.current;
      const modelMsg: TestMessage = {
        id: `model_${Date.now()}`,
        sender: 'model',
        text: completeText,
        timestamp: Date.now(),
        durationMs: elapsed,
      };

      setMessages((prev) => [...prev, modelMsg]);
      setStreamingText('');
    } catch (genErr) {
      const isCancelled =
        genErr instanceof Error && genErr.message.includes('GENERATION_CANCELLED');
      if (isCancelled) {
        setMessages((prev) => [
          ...prev,
          {
            id: `model_cancelled_${Date.now()}`,
            sender: 'model',
            text: streamingText
              ? `${streamingText}\n\n[Inference cancelled by user]`
              : '[Inference cancelled by user]',
            timestamp: Date.now(),
            durationMs: Date.now() - generationStartTimeRef.current,
          },
        ]);
        setStreamingText('');
      } else {
        const msg = genErr instanceof Error ? genErr.message : String(genErr);
        setGeneralError(`Inference error: ${msg}`);
      }
    } finally {
      setIsGenerating(false);
      setInferenceStatus(LlamaService.getInstance().getModelStatus().state);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleCancelGeneration = async () => {
    try {
      await LlamaService.getInstance().cancelGeneration();
    } catch (err) {
      console.warn('[LocalModelTestScreen] Cancel error:', err);
    }
  };

  // Status Badge Colors
  const getStatusColor = (status: ModelLifecycleState) => {
    switch (status) {
      case 'ready':
        return colors.success;
      case 'loading':
      case 'generating':
        return colors.warning;
      case 'error':
        return colors.danger;
      default:
        return colors.textMuted;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Local Model Test"
        subtitle="On-Device Gemma 3 1B SLM"
        showThemeToggle={true}
        rightAction={
          <TouchableOpacity
            style={[
              styles.headerBackBtn,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
            onPress={() => onNavigate('dashboard')}
            accessibilityLabel="Return to Dashboard"
          >
            <Ionicons name="close" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Platform Notice for Unsupported Environments */}
        {Platform.OS === 'web' && (
          <Card style={[styles.noticeCard, { backgroundColor: '#78350F22', borderColor: '#B45309' }]}>
            <View style={styles.noticeHeader}>
              <Ionicons name="information-circle-outline" size={18} color="#F59E0B" />
              <Text style={[styles.noticeTitle, { color: '#F59E0B' }]}>
                Web Runtime Notice
              </Text>
            </View>
            <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>
              Native `llama.rn` (llama.cpp JNI bindings) runs strictly inside an Android development or preview APK (`com.personalfinance.slm`). Testing native inference requires deploying the APK to a real Android device.
            </Text>
          </Card>
        )}

        {/* Global Error Banner */}
        {generalError && (
          <Card style={[styles.noticeCard, { backgroundColor: '#7F1D1D22', borderColor: colors.danger }]}>
            <View style={styles.noticeHeader}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.noticeTitle, { color: colors.danger }]}>Error</Text>
            </View>
            <Text style={[styles.noticeBody, { color: colors.textPrimary }]}>{generalError}</Text>
          </Card>
        )}

        {/* SECTION A: Model Status Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="hardware-chip-outline" size={18} color={colors.aiAccent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Model Status</Text>
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Storage Status:</Text>
              {isStorageLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: modelInfo?.isImported ? '#05966922' : '#DC262622',
                      borderColor: modelInfo?.isImported ? colors.success : colors.danger,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: modelInfo?.isImported ? colors.success : colors.danger },
                    ]}
                  >
                    {modelInfo?.isImported ? 'Imported' : 'Not Imported'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Standard Filename:</Text>
              <Text style={[styles.statusValue, { color: colors.textPrimary }]}>
                {modelInfo?.filename || 'personal-finance-slm-Q4_K_M.gguf'}
              </Text>
            </View>

            {modelInfo?.originalFilename && (
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Source Filename:</Text>
                <Text style={[styles.statusValue, { color: colors.textSecondary }]}>
                  {modelInfo.originalFilename}
                </Text>
              </View>
            )}

            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textMuted }]}>File Size:</Text>
              <Text style={[styles.statusValue, { color: colors.textPrimary }]}>
                {modelInfo?.sizeFormatted || '—'}
              </Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Inference Engine:</Text>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: `${getStatusColor(inferenceStatus)}22`,
                    borderColor: getStatusColor(inferenceStatus),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    { color: getStatusColor(inferenceStatus), textTransform: 'capitalize' },
                  ]}
                >
                  {inferenceStatus}
                </Text>
              </View>
            </View>
          </View>

          {/* Model storage path */}
          <View style={[styles.pathContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.pathLabel, { color: colors.textMuted }]}>Persistent Storage Path:</Text>
            <Text style={[styles.pathText, { color: colors.textSecondary }]} numberOfLines={2} ellipsizeMode="middle">
              {modelInfo?.path || getModelPath()}
            </Text>
          </View>
        </Card>

        {/* SECTION B: Storage Import / Replace / Delete */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="folder-open-outline" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Storage Management
            </Text>
          </View>

          {isImporting ? (
            <View style={styles.importingBox}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.importingText, { color: colors.textPrimary }]}>
                Streaming model into private storage... ({(importProgress * 100).toFixed(0)}%)
              </Text>
            </View>
          ) : !modelInfo?.isImported ? (
            <View>
              <Text style={[styles.hintText, { color: colors.textMuted }]}>
                Select the fine-tuned Gemma 3 1B GGUF model file from your device storage to import it into the private application sandbox.
              </Text>
              <Button
                title="Import GGUF Model"
                icon="cloud-upload-outline"
                variant="primary"
                onPress={() => handleImportModel(false)}
                style={styles.actionBtn}
              />
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <Button
                title="Replace Model"
                icon="swap-horizontal-outline"
                variant="secondary"
                size="sm"
                onPress={handleReplaceModel}
                style={[styles.halfBtn, { marginRight: 8 }]}
              />
              <Button
                title="Delete Model"
                icon="trash-outline"
                variant="danger"
                size="sm"
                onPress={handleDeleteModel}
                style={styles.halfBtn}
              />
            </View>
          )}
        </Card>

        {/* SECTION C & E: Model Load & Release Context */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="terminal-outline" size={18} color={colors.aiAccent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Inference Lifecycle
            </Text>
          </View>

          {isLoadingModel ? (
            <View style={styles.importingBox}>
              <ActivityIndicator size="small" color={colors.aiAccent} />
              <Text style={[styles.importingText, { color: colors.textPrimary }]}>
                Initializing native JNI llama.cpp context... ({(loadProgress * 100).toFixed(0)}%)
              </Text>
            </View>
          ) : inferenceStatus === 'unloaded' || inferenceStatus === 'error' ? (
            <View>
              <Text style={[styles.hintText, { color: colors.textMuted }]}>
                Loads the model into native memory using CPU threads, mmap, and a 2048 token context window.
              </Text>
              <Button
                title="Load Model (CPU · 4 Threads)"
                icon="play-outline"
                variant="primary"
                disabled={!modelInfo?.isImported || isLoadingModel}
                onPress={handleLoadModel}
                style={styles.actionBtn}
              />
            </View>
          ) : (
            <View>
              <View style={[styles.loadedBanner, { backgroundColor: '#05966915', borderColor: colors.success }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[styles.loadedBannerText, { color: colors.success }]}>
                  Native Context Active · 2048 Context · 4 Threads
                </Text>
              </View>
              <Button
                title="Release Model Context"
                icon="stop-outline"
                variant="outline"
                disabled={isGenerating}
                onPress={handleReleaseModel}
                style={styles.actionBtn}
              />
            </View>
          )}
        </Card>

        {/* SECTION D: Test Inference Area */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.aiAccent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              On-Device Inference Test
            </Text>
          </View>

          {/* Quick preset pills */}
          <Text style={[styles.presetLabel, { color: colors.textMuted }]}>Quick Test Prompts:</Text>
          <View style={styles.presetRow}>
            <TouchableOpacity
              style={[styles.presetPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => setPromptText('Explain what a monthly budget is in simple language.')}
            >
              <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>
                Monthly Budget
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => setPromptText('What is the 50/30/20 budgeting rule?')}
            >
              <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>
                50/30/20 Rule
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => setPromptText('How does emergency fund prevent debt in India?')}
            >
              <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>
                Emergency Fund
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input text */}
          <TextInput
            style={[
              styles.promptInput,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder="Enter test prompt for Gemma 3..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={promptText}
            onChangeText={setPromptText}
            editable={!isGenerating && inferenceStatus === 'ready'}
          />

          {/* Action buttons */}
          <View style={styles.inferenceActionRow}>
            <Button
              title={isGenerating ? 'Generating...' : 'Send Prompt'}
              icon="sparkles"
              variant="primary"
              disabled={isGenerating || inferenceStatus !== 'ready' || !promptText.trim()}
              onPress={handleSendPrompt}
              style={[styles.halfBtn, { marginRight: 8 }]}
            />
            {isGenerating && (
              <Button
                title="Cancel"
                icon="close-circle-outline"
                variant="danger"
                onPress={handleCancelGeneration}
                style={styles.halfBtn}
              />
            )}
          </View>

          {/* Conversation & Streaming Log */}
          <View style={styles.logContainer}>
            <Text style={[styles.logHeader, { color: colors.textMuted }]}>Inference Output Log:</Text>

            {messages.length === 0 && !streamingText && (
              <Text style={[styles.emptyLogText, { color: colors.textMuted }]}>
                No queries executed yet. Load the model and click "Send Prompt" to test local generation.
              </Text>
            )}

            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.messageBubble,
                  { borderRadius: borderRadius.md },
                  m.sender === 'user'
                    ? [styles.userBubble, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 }]
                    : [styles.modelBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
                ]}
              >
                <View style={styles.messageMetaRow}>
                  <Text
                    style={[
                      styles.messageSender,
                      { color: m.sender === 'user' ? colors.textPrimary : colors.aiAccent },
                    ]}
                  >
                    {m.sender === 'user' ? 'Prompt' : 'Gemma 3 1B Output'}
                  </Text>
                  {m.durationMs !== undefined && (
                    <Text style={[styles.durationText, { color: colors.textMuted }]}>
                      {(m.durationMs / 1000).toFixed(2)}s
                    </Text>
                  )}
                </View>
                <Text style={[styles.messageText, { color: colors.textPrimary }]}>{m.text}</Text>
              </View>
            ))}

            {/* In-Flight Streaming Display */}
            {isGenerating && streamingText.length > 0 && (
              <View style={[styles.messageBubble, styles.modelBubble, { borderRadius: borderRadius.md, backgroundColor: colors.surface, borderColor: colors.aiAccent }]}>
                <View style={styles.messageMetaRow}>
                  <Text style={[styles.messageSender, { color: colors.aiAccent }]}>
                    Gemma 3 1B (Streaming...)
                  </Text>
                  <ActivityIndicator size="small" color={colors.aiAccent} />
                </View>
                <Text style={[styles.messageText, { color: colors.textPrimary }]}>{streamingText}</Text>
              </View>
            )}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  headerBackBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 8,
  },
  noticeCard: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  noticeBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  statusGrid: {
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pathContainer: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  pathLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  pathText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  importingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  importingText: {
    fontSize: 13,
    marginLeft: 10,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  actionBtn: {
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  halfBtn: {
    flex: 1,
  },
  loadedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  loadedBannerText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  promptInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  inferenceActionRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  logContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(38, 50, 71, 0.5)',
    paddingTop: 12,
  },
  logHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  emptyLogText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'stretch',
  },
  modelBubble: {
    alignSelf: 'stretch',
    borderWidth: 1,
  },
  messageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  durationText: {
    fontSize: 10,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
});

