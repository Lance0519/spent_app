import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator, 
  Alert, 
  Platform,
  NativeModules 
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import { X, Zap, ZapOff, FlipHorizontal, Image as ImageIcon, Camera, AlertCircle, Info } from 'lucide-react-native';
import tw from 'twrnc';
import { parseReceipt, ParsedReceipt, generateFormattedNotes } from '../utils/ReceiptParser';
import { useTheme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (parsedReceipt: ParsedReceipt) => void;
}

export const ReceiptCameraScanner: React.FC<Props> = ({
  visible,
  onClose,
  onScanSuccess,
}) => {
  const { accentColor, textOnAccent, currencySymbol } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [enableTorch, setEnableTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Reading receipt with on-device ML Kit...');

  const cameraRef = useRef<CameraView>(null);

  // Check if native ML Kit module is linked (false in standard Expo Go)
  const isNativeOCRSupported = Boolean(NativeModules.TextRecognition);

  const processImageUri = async (imageUri: string) => {
    try {
      setIsProcessing(true);
      setStatusMessage('Reading receipt with on-device ML Kit...');

      // If running inside standard Expo Go, native ML Kit C++/Java libraries are not compiled in
      if (!isNativeOCRSupported) {
        setStatusMessage('Expo Go detected: Simulating receipt parsing...');
        await new Promise(resolve => setTimeout(resolve, 800));

        // Sample Meralco bill with missing decimal points caused by scanner hardware limitations
        const sampleMeralcoOcr = `MERALCO
MANILA ELECTRIC COMPANY
Account No: 1234-5678-9012
Bill Date: 2026-08-15
Due Date: 2026-09-02

BREAKDOWN OF ELECTRICITY CHARGES
Generation 173598
Transmission 30154
System Loss 16047
Distribution (Meralco) 41862
Senior Citizen 2
Government Taxes 31577
Universal Charges 6657
FIT-All (Renewable) 4163
GEA-All (Renewable) 768
Lifeline 207
Other Charges 2458

PLEASE PAY ₱ 307493`;

        const meralcoParsed = parseReceipt({ text: sampleMeralcoOcr, blocks: [] }, currencySymbol);

        const demoItems = [
          { id: `item_1_${Date.now()}`, description: 'Caffè Latte Grande', price: 195.00 },
          { id: `item_2_${Date.now()}`, description: 'Caramel Macchiato Grande', price: 185.00 },
        ];
        const todayIso = new Date().toISOString().split('T')[0];
        const starbucksParsed: ParsedReceipt = {
          merchant: 'STARBUCKS COFFEE',
          date: todayIso,
          totalAmount: 380.00,
          items: demoItems,
          rawText: 'STARBUCKS COFFEE\nDate: 2026-09-09\nCaffè Latte Grande 195.00\nCaramel Macchiato Grande 185.00\nTotal Amount Due 380.00',
          formattedNotes: generateFormattedNotes('STARBUCKS COFFEE', todayIso, 380.00, demoItems, currencySymbol)
        };

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Select Sample (Expo Go Demo)',
          'Choose a bill type to test OCR parsing and real-time state synchronization:\n\n• Meralco Bill tests the centavo fallback (missing decimals fixed) and real-time itemized price updates.\n• For physical camera scanning with live Google ML Kit, run: npx expo run:android',
          [
            {
              text: 'Meralco Utility Bill (Test Fix)',
              onPress: () => {
                onScanSuccess(meralcoParsed);
                onClose();
              }
            },
            {
              text: 'Starbucks Receipt',
              onPress: () => {
                onScanSuccess(starbucksParsed);
                onClose();
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => onClose()
            }
          ]
        );
        return;
      }

      // Execute on-device offline ML Kit text recognition
      const ocrResult = await TextRecognition.recognize(imageUri);

      if (!ocrResult || !ocrResult.text || ocrResult.text.trim().length === 0) {
        Alert.alert(
          'Unreadable Receipt',
          'No text could be recognized from the image. Please ensure the receipt is well-lit, laid flat, and in focus.'
        );
        return;
      }

      setStatusMessage('Extracting merchant, date, and item breakdown...');
      const parsed = parseReceipt(ocrResult, currencySymbol);

      if (parsed.items.length === 0 && parsed.totalAmount === 0) {
        Alert.alert(
          'No Items Detected',
          'Could not extract items or total from the image. Please verify the receipt details manually.',
          [
            {
              text: 'OK',
              onPress: () => {
                onScanSuccess(parsed);
                onClose();
              }
            }
          ]
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onScanSuccess(parsed);
      onClose();
    } catch (error) {
      console.error('Receipt recognition error:', error);
      Alert.alert(
        'Scan Failed',
        `An error occurred while recognizing the receipt: ${(error as Error).message || 'Unknown error'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo?.uri) {
        await processImageUri(photo.uri);
      } else {
        Alert.alert('Capture Error', 'Could not capture photo. Please try again.');
      }
    } catch (err) {
      Alert.alert('Camera Error', (err as Error).message || 'Failed to capture receipt.');
    }
  };

  const handlePickFromGallery = async () => {
    if (isProcessing) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        await processImageUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Gallery Error', (err as Error).message || 'Could not pick image.');
    }
  };

  const toggleTorch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnableTorch(prev => !prev);
  };

  const toggleCameraFacing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black`}>
        {/* Permission Request View */}
        {!permission?.granted ? (
          <View style={tw`flex-1 bg-[#141218] items-center justify-center p-6`}>
            <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-6`, { backgroundColor: `${accentColor}20` }]}>
              <Camera size={40} color={accentColor} />
            </View>
            <Text style={tw`text-white font-black text-2xl mb-2 text-center`}>Camera Access Needed</Text>
            <Text style={tw`text-slate-300 text-center text-sm font-medium mb-8 max-w-xs leading-5`}>
              SPENT uses your device camera to capture receipts and run on-device optical character recognition completely offline.
            </Text>

            <TouchableOpacity
              onPress={requestPermission}
              style={[tw`w-full py-4 rounded-2xl items-center mb-3 min-h-[48px] justify-center`, { backgroundColor: accentColor }]}
            >
              <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Grant Camera Permission</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickFromGallery}
              style={tw`w-full py-3.5 rounded-2xl items-center bg-white/10 border border-white/20 mb-3 min-h-[48px] justify-center`}
            >
              <Text style={tw`text-white font-bold text-sm`}>Upload from Photos Instead</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={tw`py-3 min-h-[48px] justify-center`}>
              <Text style={tw`text-slate-400 font-bold text-sm`}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={tw`flex-1 relative`}>
            {/* Camera View */}
            <CameraView
              ref={cameraRef}
              style={tw`flex-1`}
              facing={facing}
              enableTorch={enableTorch}
            >
              {/* Overlay with Viewfinder */}
              <View style={tw`flex-1 justify-between p-6 pt-14 pb-12`}>
                
                {/* Top Controls Bar */}
                <View style={tw`flex-row justify-between items-center bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-full`}>
                  <TouchableOpacity onPress={onClose} style={tw`w-10 h-10 rounded-full bg-white/20 items-center justify-center`}>
                    <X size={20} color="#fff" />
                  </TouchableOpacity>

                  <Text style={tw`text-white font-bold text-sm tracking-wide`}>Scan Physical Receipt</Text>

                  <View style={tw`flex-row gap-2`}>
                    <TouchableOpacity onPress={toggleTorch} style={tw`w-10 h-10 rounded-full bg-white/20 items-center justify-center`}>
                      {enableTorch ? <Zap size={18} color="#facc15" /> : <ZapOff size={18} color="#fff" />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleCameraFacing} style={tw`w-10 h-10 rounded-full bg-white/20 items-center justify-center`}>
                      <FlipHorizontal size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {!isNativeOCRSupported && (
                  <View style={tw`mt-2 self-center bg-amber-500/90 px-3 py-1 rounded-full flex-row items-center`}>
                    <Info size={12} color="#fff" style={tw`mr-1`} />
                    <Text style={tw`text-white text-[10px] font-bold`}>
                      Expo Go: Demo Mode (Run 'npx expo run:android' for live ML Kit)
                    </Text>
                  </View>
                )}

                {/* Viewfinder Target Frame */}
                <View style={tw`items-center justify-center my-auto`}>
                  <View style={tw`w-[86%] h-96 border-2 border-white/60 rounded-3xl relative overflow-hidden justify-between p-4 bg-black/10`}>
                    {/* Corner Guides */}
                    <View style={tw`flex-row justify-between`}>
                      <View style={tw`w-6 h-6 border-t-4 border-l-4 rounded-tl-lg border-white`} />
                      <View style={tw`w-6 h-6 border-t-4 border-r-4 rounded-tr-lg border-white`} />
                    </View>

                    <View style={tw`items-center bg-black/50 px-3 py-1.5 rounded-full self-center`}>
                      <Text style={tw`text-white text-xs font-bold tracking-wide`}>
                        Position receipt inside the frame
                      </Text>
                    </View>

                    <View style={tw`flex-row justify-between`}>
                      <View style={tw`w-6 h-6 border-b-4 border-l-4 rounded-bl-lg border-white`} />
                      <View style={tw`w-6 h-6 border-b-4 border-r-4 rounded-br-lg border-white`} />
                    </View>
                  </View>
                </View>

                {/* Bottom Action Controls */}
                <View style={tw`flex-row items-center justify-around px-4`}>
                  {/* Gallery Picker Fallback */}
                  <TouchableOpacity 
                    onPress={handlePickFromGallery}
                    style={tw`w-12 h-12 rounded-full bg-white/20 items-center justify-center border border-white/30`}
                  >
                    <ImageIcon size={22} color="#fff" />
                  </TouchableOpacity>

                  {/* Primary Shutter Button */}
                  <TouchableOpacity
                    onPress={handleCapture}
                    disabled={isProcessing}
                    style={tw`w-20 h-20 rounded-full border-4 border-white items-center justify-center p-1 bg-white/30`}
                  >
                    <View style={[tw`w-full h-full rounded-full`, { backgroundColor: accentColor }]} />
                  </TouchableOpacity>

                  {/* Spacer for symmetry */}
                  <View style={tw`w-12 h-12`} />
                </View>
              </View>
            </CameraView>

            {/* Offline ML Processing Overlay */}
            {isProcessing && (
              <View style={tw`absolute inset-0 bg-black/75 items-center justify-center p-6 z-50`}>
                <View style={tw`bg-[#211F26] p-6 rounded-3xl items-center border border-white/10 shadow-2xl max-w-xs w-full`}>
                  <ActivityIndicator size="large" color={accentColor} style={tw`mb-4`} />
                  <Text style={tw`text-white font-black text-lg text-center mb-1`}>Processing Receipt</Text>
                  <Text style={tw`text-slate-300 text-xs font-medium text-center leading-4`}>
                    {statusMessage}
                  </Text>
                  <View style={tw`mt-4 px-3 py-1 bg-white/10 rounded-full`}>
                    <Text style={tw`text-[11px] font-bold text-slate-300`}>100% On-Device ML</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};
