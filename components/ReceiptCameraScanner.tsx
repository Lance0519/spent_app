import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator, 
  Alert, 
  Platform,
  NativeModules,
  Linking
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
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
  const [receiptMode, setReceiptMode] = useState<'long' | 'standard'>('long');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Reading receipt with on-device ML Kit...');

  const cameraRef = useRef<CameraView>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, [visible]);

  // Check if native ML Kit module is linked (false in standard Expo Go)
  const isNativeOCRSupported = Boolean(NativeModules.TextRecognition);

  const processImageUri = async (imageUri: string) => {
    try {
      if (!isMounted.current) return;
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

        // Sample Savemore supermarket receipt
        const sampleSavemoreOcr = `Savemore Market
SANFORD MARKETING CORPORATION
Savemore Market Camarin Kiko/Monte Heights
Annex Zone 15 Brgy. 176 1400 Caloocan C
ity NCR Third Dist. Philippines
VAT-REG TIN 207-981-175-00075
SN#683025650502086 MIN#26060108213341569
Sales Invoice
SI#0000010434
PHP
2 X 61.75
DwnyFbconPessn6+1 123.50
2 X 96.00
ArielPOxB1ch66x6 192.00
2 X 26.00
SN Bonus Sponge 52.00
+ CDOulanBrgchs225 67.00
+ MARBY SqdBal1200 64.00
+ CdoldHotdogRg250 62.50
+ YAKULT Light 5s 60.00
MangTomasLechonSga 42.50
4 X 25.25
+ NissinHotChsySfd 101.00
+ DatuPutinVilSup 46.50
MnSitaOyster309x12 73.00
+ BEARBRAND 33Gx8 100.00
SUPER STIX UBE330G 94.50
Presto PBtter30x10 70.00
RebscoWfertme11x20 59.50
RebiscoWaferTRCray 89.50
2 X 8.50
KireiYmyFkSpcyShrn 17.00
loaddwhtChcof1d65g 19.50
+ SMB BrownSugar1k 73.00
RGNTTRYAKICHK100G 24.95
AjiCrspyFryXtrSpcy 14.50
AjinomotoCrspyMx62 20.00
AjinomotoBreadSpcy 20.00
2 X 40.00
+ Argen.Cbef175 G 80.00
2 X 24.00
+ YT SardTS Inp155 48.00
BrownieNuttyDlight 94.50
JJ Piattos 85g 39.50
LSCheeseCakeBig42g 114.50
Subtotal 1,862.95
Discount 0.00
VAT 0.00
Total 1,862.95
Offline BDO Credit 1,862.95
546497XXXXXX6747
ISSUER NAME: Offline BDO Credit
ISSUER ID: 01
AUTH CODE: 014535
ITEMS PURCHASED 37
MEMBER ID: ******3358
MEMBER NAME: NEU*********
Vatable Sales 1,663.38`;

        const savemoreParsed = parseReceipt({ text: sampleSavemoreOcr, blocks: [] }, currencySymbol);

        if (!isMounted.current) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Select Sample (Expo Go Demo)',
          'Choose a receipt to test OCR parsing and item breakdown:\n\n• Savemore Supermarket tests multi-item grocery parsing, quantity multipliers (2x @ 61.75), and ₱1,862.95 total.\n• Meralco tests utility bill parsing.\n• Starbucks tests compact café receipts.',
          [
            {
              text: 'Savemore Grocery Receipt (Test Fix)',
              onPress: () => {
                if (!isMounted.current) return;
                onScanSuccess(savemoreParsed);
                onClose();
              }
            },
            {
              text: 'Meralco Utility Bill',
              onPress: () => {
                if (!isMounted.current) return;
                onScanSuccess(meralcoParsed);
                onClose();
              }
            },
            {
              text: 'Starbucks Receipt',
              onPress: () => {
                if (!isMounted.current) return;
                onScanSuccess(starbucksParsed);
                onClose();
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                if (!isMounted.current) return;
                onClose();
              }
            }
          ]
        );
        return;
      }

      // Execute on-device offline ML Kit text recognition
      const ocrResult = await TextRecognition.recognize(imageUri);

      if (!isMounted.current) return;

      if (!ocrResult || !ocrResult.text || ocrResult.text.trim().length === 0) {
        Alert.alert(
          'Unreadable Receipt',
          'No text could be recognized from the image. Please ensure the receipt is well-lit, laid flat, and in focus.'
        );
        return;
      }

      setStatusMessage('Extracting merchant, date, and item breakdown...');
      
      // Yield to UI thread to allow spinner to render before heavy parsing blocks the thread
      await new Promise(resolve => setTimeout(resolve, 50));
      if (!isMounted.current) return;

      const parsed = parseReceipt(ocrResult, currencySymbol);

      if (parsed.items.length === 0 && parsed.totalAmount === 0) {
        Alert.alert(
          'Receipt Scan Incomplete',
          'Could not clearly detect items or total. Would you like to retake with better lighting, or proceed and enter details manually?',
          [
            {
              text: 'Retake Photo',
              style: 'cancel'
            },
            {
              text: 'Enter Manually',
              onPress: () => {
                if (!isMounted.current) return;
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
      if (!isMounted.current) return;
      Alert.alert(
        'Scan Failed',
        `An error occurred while recognizing the receipt: ${(error as Error).message || 'Unknown error'}`
      );
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
      try {
        await FileSystem.deleteAsync(imageUri, { idempotent: true });
      } catch (e) {}
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
              onPress={() => {
                if (permission?.canAskAgain) {
                  requestPermission();
                } else {
                  Linking.openSettings();
                }
              }}
              style={[tw`w-full py-4 rounded-2xl items-center mb-3 min-h-[48px] justify-center`, { backgroundColor: accentColor }]}
            >
              <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>
                {permission?.canAskAgain ? 'Grant Camera Permission' : 'Open Settings'}
              </Text>
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

                {/* Receipt Mode Toggle Pill */}
                <View style={tw`flex-row self-center mt-2 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/20`}>
                  <TouchableOpacity
                    onPress={() => setReceiptMode('long')}
                    style={[
                      tw`px-3 py-1 rounded-full`,
                      receiptMode === 'long' ? { backgroundColor: accentColor } : tw`bg-transparent`
                    ]}
                  >
                    <Text style={[tw`text-[11px] font-bold`, receiptMode === 'long' ? { color: textOnAccent } : tw`text-white/80`]}>
                      Long / Supermarket
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setReceiptMode('standard')}
                    style={[
                      tw`px-3 py-1 rounded-full`,
                      receiptMode === 'standard' ? { backgroundColor: accentColor } : tw`bg-transparent`
                    ]}
                  >
                    <Text style={[tw`text-[11px] font-bold`, receiptMode === 'standard' ? { color: textOnAccent } : tw`text-white/80`]}>
                      Standard
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Viewfinder Target Frame */}
                <View style={tw`items-center justify-center flex-1 my-2`}>
                  <View style={[
                    tw`border-2 border-white/60 rounded-3xl relative overflow-hidden justify-between p-4 bg-black/10`,
                    receiptMode === 'long' ? tw`w-[88%] h-[92%]` : tw`w-[86%] h-80`
                  ]}>
                    {/* Corner Guides */}
                    <View style={tw`flex-row justify-between`}>
                      <View style={tw`w-6 h-6 border-t-4 border-l-4 rounded-tl-lg border-white`} />
                      <View style={tw`w-6 h-6 border-t-4 border-r-4 rounded-tr-lg border-white`} />
                    </View>

                    <View style={tw`items-center bg-black/60 px-3.5 py-1.5 rounded-full self-center border border-white/20`}>
                      <Text style={tw`text-white text-xs font-bold tracking-wide`}>
                        {receiptMode === 'long'
                          ? 'Frame full receipt (header to total)'
                          : 'Position receipt inside frame'}
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
