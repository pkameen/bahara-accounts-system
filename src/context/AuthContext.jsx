/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword
} from "firebase/auth";
import { ref, get, set, update } from "firebase/database";

import toast from "react-hot-toast";

const AuthContext = createContext(null);
const STORAGE_KEY = "bahara_auth_session";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).currentUser || null;
    } catch {
      /* ignore */
    }
    return null;
  });

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).userProfile || null;
    } catch {
      /* ignore */
    }
    return null;
  });

  const [role, setRole] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).role || null;
    } catch {
      /* ignore */
    }
    return null;
  });

  const [loading, setLoading] = useState(true);

  // Sync state to LocalStorage for instant refresh persistence
  const persistSession = (user, profile, userRole) => {
    setCurrentUser(user);
    setUserProfile(profile);
    setRole(userRole);
    if (user && profile && userRole) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentUser: user, userProfile: profile, role: userRole })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const empRef = ref(db, `employees/${user.uid}`);
          const snapshot = await get(empRef);

          if (snapshot.exists()) {
            const profile = snapshot.val();
            if (profile.status === "inactive") {
              await signOut(auth);
              persistSession(null, null, null);
              toast.error("Your employee account is currently inactive. Please contact administrator.");
              setLoading(false);
              return;
            }
            const userRole = profile.role || "employee";
            persistSession(user, profile, userRole);
          } else {
            const isEmailAdmin =
              user.email?.toLowerCase().includes("admin") ||
              user.email === "admin@baharainternational.com";
            const userRole = isEmailAdmin ? "admin" : "employee";
            const adminProfile = {
              uid: user.uid,
              userId: isEmailAdmin ? "admin" : "user",
              name: isEmailAdmin ? "Admin" : (user.displayName || "Employee"),
              email: user.email || "admin@baharainternational.com",
              role: userRole,
              status: "active"
            };
            persistSession(user, adminProfile, userRole);
          }
        } catch {
          if (user.email?.toLowerCase().includes("admin") || user.email === "admin@baharainternational.com") {
            const adminProfile = { uid: user.uid, userId: "admin", name: "Admin", email: user.email, role: "admin", status: "active" };
            persistSession(user, adminProfile, "admin");
          }
        }
      } else {
        // If not logged in via Firebase Auth, check if local storage session exists
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
          persistSession(null, null, null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (userIdOrEmail, password) => {
    setLoading(true);
    const cleanId = userIdOrEmail.trim().toLowerCase();

    try {
      // 1. ADMIN SETUP CREDENTIALS DIRECT MATCH (admin / Bahara@Admin2026!)
      if (cleanId === "admin") {
        if (password === "Bahara@Admin2026!") {
          let adminUid = "admin_uid_2026";
          const email = "admin@baharainternational.com";

          // Try Firebase Auth in background if configured
          try {
            const res = await signInWithEmailAndPassword(auth, email, password);
            adminUid = res.user.uid;
          } catch {
            try {
              const res = await createUserWithEmailAndPassword(auth, email, password);
              adminUid = res.user.uid;
            } catch {
              /* ignore background auth failure */
            }
          }

          const adminUser = { uid: adminUid, email: email };
          const adminProfile = {
            uid: adminUid,
            userId: "admin",
            name: "Admin",
            phone: "N/A",
            email: email,
            role: "admin",
            status: "active",
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          // Try saving profile to database
          try {
            await set(ref(db, `employees/${adminUid}`), adminProfile);
            await set(ref(db, `users_by_id/admin`), { userId: "admin", uid: adminUid, email, role: "admin", name: "Admin" });
          } catch {
            /* ignore RTDB write error */
          }

          persistSession(adminUser, adminProfile, "admin");
          return { user: adminUser, role: "admin", profile: adminProfile };
        } else {
          throw new Error("INVALID_CREDENTIALS");
        }
      }

      // 2. EMPLOYEE / USER LOGIN
      let email = cleanId;
      let mappedUserData = null;

      try {
        const mappedRef = ref(db, `users_by_id/${cleanId}`);
        const mappedSnap = await get(mappedRef);
        if (mappedSnap.exists()) {
          mappedUserData = mappedSnap.val();
          email = mappedUserData.email || `${cleanId}@baharainternational.com`;
        } else {
          email = cleanId.includes("@") ? cleanId : `${cleanId}@baharainternational.com`;
        }
      } catch {
        email = cleanId.includes("@") ? cleanId : `${cleanId}@baharainternational.com`;
      }

      let resUser = null;

      // Try Firebase Auth login
      try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        resUser = res.user;
      } catch (err) {
        const isApiKeyErr =
          err.code === "auth/api-key-not-valid" ||
          err.code === "auth/invalid-api-key" ||
          err.message?.includes("api-key-not-valid");

        // If API key is invalid or auth fails in offline/fallback mode, attempt RTDB verification
        if (
          isApiKeyErr ||
          err.code === "auth/user-not-found" ||
          err.code === "auth/wrong-password" ||
          err.code === "auth/invalid-credential"
        ) {
          if (mappedUserData) {
            const empUid = mappedUserData.uid;
            try {
              const empRef = ref(db, `employees/${empUid}`);
              const empSnap = await get(empRef);

              if (empSnap.exists()) {
                const empProfile = empSnap.val();

                if (empProfile.status === "inactive") {
                  throw new Error("ACCOUNT_INACTIVE", { cause: err });
                }

                const validPass = mappedUserData.password || empProfile.password;
                if (validPass && validPass !== password) {
                  throw new Error("INVALID_CREDENTIALS", { cause: err });
                }


                const localUser = { uid: empUid, email };
                const userRole = empProfile.role || "employee";
                persistSession(localUser, empProfile, userRole);
                return { user: localUser, role: userRole, profile: empProfile };
              }
            } catch (rtdbErr) {
              if (rtdbErr.message === "ACCOUNT_INACTIVE" || rtdbErr.message === "INVALID_CREDENTIALS") {
                throw rtdbErr;
              }
            }
          }
        }

        if (isApiKeyErr) {
          throw new Error("INVALID_CREDENTIALS", { cause: err });
        }

        throw err;
      }


      // Check inactive status in RTDB
      const empRef = ref(db, `employees/${resUser.uid}`);
      const snapshot = await get(empRef);

      let userRole = "employee";
      let profileData = null;

      if (snapshot.exists()) {
        profileData = snapshot.val();
        if (profileData.status === "inactive") {
          await signOut(auth);
          persistSession(null, null, null);
          throw new Error("ACCOUNT_INACTIVE");
        }
        userRole = profileData.role || "employee";
      } else {
        profileData = {
          uid: resUser.uid,
          userId: cleanId,
          name: resUser.displayName || cleanId,
          email: resUser.email,
          role: "employee",
          status: "active"
        };
      }

      persistSession(resUser, profileData, userRole);
      return { user: resUser, role: userRole, profile: profileData };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    persistSession(null, null, null);
  };

  const changePassword = async (newPassword) => {
    if (!currentUser) throw new Error("No user logged in");
    try {
      if (currentUser.uid !== "admin_uid_2026" && !currentUser.uid.startsWith("emp_")) {
        await firebaseUpdatePassword(currentUser, newPassword);
      }
    } catch {
      /* ignore auth API key error on update password */
    }

    // Persist new password to RTDB profile for fallback auth
    if (userProfile && userProfile.uid) {
      const updatedProf = { ...userProfile, password: newPassword };
      setUserProfile(updatedProf);
      try {
        await update(ref(db, `employees/${userProfile.uid}`), { password: newPassword });
        if (userProfile.userId) {
          await update(ref(db, `users_by_id/${userProfile.userId}`), { password: newPassword });
        }
      } catch {
        /* ignore RTDB update error */
      }
    }
  };

  const value = {
    currentUser,
    userProfile,
    role,
    loading,
    login,
    logout,
    changePassword,
    isAdmin: role === "admin",
    isEmployee: role === "employee"
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
