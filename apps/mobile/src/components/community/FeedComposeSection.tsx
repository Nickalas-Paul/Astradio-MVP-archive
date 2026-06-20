import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { formatApiError } from '../../lib/format-api-error';
import { colors } from '../../constants/colors';

type FeedComposeSectionProps = {
  submitPost: (
    body: string,
    title?: string,
    imageUri?: string | null,
    imageMimeType?: string | null
  ) => Promise<{ moderationWarning?: string }>;
};

type SelectedImage = {
  uri: string;
  mimeType: string;
};

export function FeedComposeSection({ submitPost }: FeedComposeSectionProps) {
  const [body, setBody] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [posting, setPosting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
    });
  };

  const handlePost = async () => {
    const trimmed = body.trim();
    if (!trimmed && !selectedImage) return;
    setPosting(true);
    try {
      const { moderationWarning } = await submitPost(
        trimmed,
        undefined,
        selectedImage?.uri,
        selectedImage?.mimeType
      );
      setBody('');
      setSelectedImage(null);
      if (moderationWarning) {
        Alert.alert('Image not added', moderationWarning);
      }
    } catch (err) {
      Alert.alert('Could not post', formatApiError(err, 'Something went wrong'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.composeCard}>
      <Text style={styles.composeTitle}>Share with the community</Text>
      <TextInput
        style={styles.composeInput}
        placeholder="What's on your mind?"
        placeholderTextColor={colors.text.muted}
        value={body}
        onChangeText={setBody}
        multiline
        textAlignVertical="top"
      />
      {selectedImage ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
          <Pressable style={styles.removePreview} onPress={() => setSelectedImage(null)}>
            <Text style={styles.removePreviewText}>Remove</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composeActions}>
        <Pressable style={styles.attachButton} onPress={() => void pickImage()} disabled={posting}>
          <Text style={styles.attachIcon}>📷</Text>
        </Pressable>
        <Pressable
          style={[styles.postButton, posting && styles.postButtonDisabled]}
          onPress={() => void handlePost()}
          disabled={posting || (!body.trim() && !selectedImage)}
        >
          {posting ? (
            <ActivityIndicator size="small" color={colors.text.primary} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composeCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  composeTitle: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 10,
  },
  composeInput: {
    minHeight: 88,
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    lineHeight: 22,
  },
  previewWrap: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceLight,
  },
  removePreview: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.overlay,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removePreviewText: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
  },
  composeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  attachButton: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 22,
  },
  postButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
});
