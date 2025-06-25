// Firebase 동적 로딩을 위한 모듈
let firebaseApp: any = null;
let firebaseAuth: any = null;

// Firebase 초기화 함수 (lazy loading)
const initializeFirebase = async () => {
  if (firebaseApp && firebaseAuth) {
    return { firebase: firebaseApp, auth: firebaseAuth };
  }

  try {
    // Firebase 모듈들을 동적으로 import
    const [{ initializeApp }, { getAuth }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth')
    ]);

    const firebaseConfig = {
      apiKey: "AIzaSyD92M6cUbsFWPDm6OHCtLYAzNlo-x8TEZc",
      authDomain: "lovlechat-cc9c4.firebaseapp.com",
      projectId: "lovlechat-cc9c4",
      storageBucket: "lovlechat-cc9c4.firebasestorage.app",
      messagingSenderId: "1052630351111",
      appId: "1:1052630351111:web:766154f7f4631273fc19a2",
    };

    // Firebase 앱 초기화
    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);

    console.log('🔥 Firebase 동적 초기화 완료');
    return { firebase: firebaseApp, auth: firebaseAuth };
  } catch (error) {
    console.error('❌ Firebase 초기화 오류:', error);
    throw error;
  }
};

// Auth 관련 함수들 (lazy loading)
export const getFirebaseAuth = async () => {
  const { auth } = await initializeFirebase();
  return auth;
};

export const signInWithGoogle = async () => {
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const signInWithEmailAndPassword = async (email: string, password: string) => {
  const { signInWithEmailAndPassword: signIn } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  return signIn(auth, email, password);
};

export const createUserWithEmailAndPassword = async (email: string, password: string) => {
  const { createUserWithEmailAndPassword: createUser } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  return createUser(auth, email, password);
};

export const signOutUser = async () => {
  const { signOut } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  return signOut(auth);
};

export const updateUserProfile = async (displayName: string) => {
  const { updateProfile } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  if (auth.currentUser) {
    return updateProfile(auth.currentUser, { displayName });
  }
  throw new Error('No authenticated user');
};

export const sendPasswordResetEmail = async (email: string) => {
  const { sendPasswordResetEmail: sendReset } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  return sendReset(auth, email);
};

// Auth state observer (lazy loading)
export const onAuthStateChanged = async (callback: (user: any) => void) => {
  const { onAuthStateChanged: onAuthChanged } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  return onAuthChanged(auth, callback);
};

// 하위 호환성을 위한 auth 객체
export const auth = {
  get currentUser() {
    return firebaseAuth?.currentUser || null;
  }
};

// Firebase 리소스 정리
export const cleanupFirebase = () => {
  firebaseApp = null;
  firebaseAuth = null;
  console.log('🧹 Firebase 리소스 정리 완료');
};

// 디버그용 정보
export const getFirebaseInfo = () => ({
  isInitialized: !!firebaseApp,
  hasAuth: !!firebaseAuth,
  timestamp: new Date().toISOString()
}); 