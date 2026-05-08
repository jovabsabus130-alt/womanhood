import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createOrder } from '../src/api';
import { COLORS, SHADOWS } from '../src/theme';

export default function AddOrderScreen() {
  const router = useRouter();
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    Alert.alert('Add Photo', 'Choose an option', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled) {
            const asset = result.assets[0];
            const actions = asset.width > 1000 ? [{ resize: { width: 1000 } }] : [];
            const manipResult = await manipulateAsync(
              asset.uri,
              actions,
              { compress: 0.7, format: SaveFormat.JPEG }
            );
            setImage(manipResult);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Gallery access is required');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled) {
            const asset = result.assets[0];
            const actions = asset.width > 1000 ? [{ resize: { width: 1000 } }] : [];
            const manipResult = await manipulateAsync(
              asset.uri,
              actions,
              { compress: 0.7, format: SaveFormat.JPEG }
            );
            setImage(manipResult);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim() || !serialNo.trim() || !phoneNo.trim()) {
      Alert.alert('Error', 'Please fill in Name, Serial No, and Phone No.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('customerName', name.trim());
      formData.append('serialNumber', serialNo.trim());
      formData.append('phoneNumber', phoneNo.trim());
      formData.append('deliveryDueDate', dueDate.toISOString());
      formData.append('notes', notes.trim());

      if (image) {
        const ext = image.uri.split('.').pop() || 'jpg';
        formData.append('clothPhoto', {
          uri: image.uri,
          type: `image/${ext}`,
          name: `cloth_${Date.now()}.${ext}`,
        });
      }

      await createOrder(formData);
      Alert.alert('Success', 'Order created successfully!');
      router.back();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create order';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date) =>
    date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Order</Text>
        </View>

        {/* Card form */}
        <View style={styles.formCard}>
          {/* Photo area */}
          <TouchableOpacity style={styles.photoArea} onPress={pickImage} activeOpacity={0.8}>
            {image ? (
              <Image source={{ uri: image.uri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={{ fontSize: 40 }}>📷</Text>
                <Text style={styles.photoText}>Tap to add photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Fields */}
          <Text style={styles.label}>Name:</Text>
          <TextInput
            style={styles.input}
            placeholder="Customer name"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Serial No:</Text>
          <TextInput
            style={styles.input}
            placeholder="Unique serial number"
            placeholderTextColor={COLORS.textMuted}
            value={serialNo}
            onChangeText={setSerialNo}
          />

          <Text style={styles.label}>Phone No:</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor={COLORS.textMuted}
            value={phoneNo}
            onChangeText={setPhoneNo}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Date Given:</Text>
          <View style={[styles.input, styles.readOnlyField]}>
            <Text style={styles.readOnlyText}>{formatDate(new Date())}</Text>
          </View>

          <Text style={styles.label}>Due Date:</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.readOnlyText}>{formatDate(dueDate)}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setDueDate(date);
              }}
            />
          )}

          <Text style={styles.label}>Notes:</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Optional notes"
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'SAVING...' : 'SAVE'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    gap: 16,
  },
  backButton: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.white,
    fontWeight: '800',
  },
  headerTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: COLORS.textMain,
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    ...SHADOWS.card,
    marginHorizontal: 20,
    padding: 20,
    marginBottom: 40,
  },
  photoArea: {
    width: '100%',
    height: 314,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: COLORS.textMain,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textMain,
  },
  readOnlyField: {
    backgroundColor: '#EEEEEE',
  },
  readOnlyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textMain,
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  saveButton: {
    width: 165,
    height: 62,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 28,
    ...SHADOWS.btn,
  },
  saveButtonText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: COLORS.white,
  },
});
