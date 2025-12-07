import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  writeBatch,
  Timestamp,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { Trade, AppSettings } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyDTIDZUwBmJ2Z_X2noaYAiRAnzGrCLsqto",
  authDomain: "it-project-a442a.firebaseapp.com",
  projectId: "it-project-a442a",
  storageBucket: "it-project-a442a.firebasestorage.app",
  messagingSenderId: "310413101832",
  appId: "1:310413101832:web:b5d83d77a0b34d9466babd",
  measurementId: "G-VT2N5JF1K0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const TRADES_COLLECTION = 'trades';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'user_preferences';

// --- TRADES ---

export const addTrade = async (trade: Omit<Trade, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, TRADES_COLLECTION), {
      ...trade,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding trade: ", error);
    throw error;
  }
};

export const getTrades = async (limitCount = 100): Promise<Trade[]> => {
  try {
    const q = query(
      collection(db, TRADES_COLLECTION), 
      orderBy('date', 'desc'), 
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toMillis() : data.date
      } as Trade;
    });
  } catch (error) {
    console.error("Error fetching trades: ", error);
    throw error;
  }
};

export const updateTrade = async (id: string, updates: Partial<Trade>) => {
  try {
    const tradeRef = doc(db, TRADES_COLLECTION, id);
    await updateDoc(tradeRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating trade: ", error);
    throw error;
  }
};

export const deleteTrade = async (id: string) => {
  try {
    await deleteDoc(doc(db, TRADES_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting trade: ", error);
    throw error;
  }
};

export const deleteAllTrades = async () => {
  const q = query(collection(db, TRADES_COLLECTION), limit(500));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

// --- SETTINGS (CAPITAL) ---

export const saveSettings = async (settings: AppSettings) => {
  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID), settings, { merge: true });
  } catch (error) {
    console.error("Error saving settings: ", error);
    throw error;
  }
};

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    } else {
      // Default
      return { initialCapital: 1000 };
    }
  } catch (error) {
    console.error("Error getting settings: ", error);
    return { initialCapital: 1000 };
  }
};