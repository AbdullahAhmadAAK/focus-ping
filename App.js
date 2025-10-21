import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Alert,
    Switch,
    Platform,
    Image,
    Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

const INTERVAL_MINUTES = 15;
const STORAGE_KEY = '@activity_tracker_data';
const CURRENT_DAY_KEY = '@current_day';
const TRACKING_START_DAY_KEY = '@tracking_start_day';
const ONBOARDING_KEY = '@has_seen_onboarding';

// DevNauts Brand Colors - Dark Theme
const COLORS = {
    primary: '#A78BFA',      // Bright Purple
    secondary: '#60A5FA',    // Bright Blue
    accent: '#C084FC',       // Light Purple
    dark: '#000000',         // Pure Black
    cardBg: '#1A1A1A',       // Dark Card Background
    cardBorder: '#2A2A2A',   // Card Border
    light: '#0A0A0A',        // Slightly lighter black
    white: '#FFFFFF',
    success: '#10B981',      // Bright Green
    warning: '#F59E0B',      // Bright Orange
    danger: '#EF4444',       // Bright Red
    text: '#F9FAFB',         // Light text
    textLight: '#9CA3AF',    // Gray text
    purple: '#8B5CF6',       // DevNauts Purple
    blue: '#3B82F6',         // DevNauts Blue
};

export default function App() {
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [isSleepMode, setIsSleepMode] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [currentActivity, setCurrentActivity] = useState('');
    const [timeSlots, setTimeSlots] = useState([]);
    const [showSummary, setShowSummary] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [currentSlotIndex, setCurrentSlotIndex] = useState(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [trackingDate, setTrackingDate] = useState(null);

    const intervalRef = useRef(null);
    const notificationListener = useRef(null);
    const responseListener = useRef(null);

    // Load saved data on mount and setup notifications
    useEffect(() => {
        checkOnboarding();
        loadData();
        registerForPushNotificationsAsync();

        // Listen for notifications when app is in foreground
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification received:', notification);
        });

        // Listen for notification responses (when user taps notification)
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Notification tapped:', response);
            // Show the prompt when notification is tapped
            const slotIndex = getCurrentSlotIndex();
            if (slotIndex >= 0 && slotIndex < timeSlots.length && !timeSlots[slotIndex].activity && !isSleepMode) {
                setEditingSlot(slotIndex);
                setCurrentActivity('');
                setShowPrompt(true);
            }
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    // Check for current slot and prompt when tracking
    useEffect(() => {
        if (isTracking) {
            checkCurrentSlot();

            // Check every minute if we're in a new slot
            intervalRef.current = setInterval(() => {
                checkCurrentSlot();
            }, 60000); // Check every minute

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
    }, [isTracking, timeSlots, isSleepMode]);

    const checkOnboarding = async () => {
        try {
            const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
            setHasSeenOnboarding(seen === 'true');
        } catch (error) {
            console.error('Error checking onboarding:', error);
        }
    };

    const registerForPushNotificationsAsync = async () => {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get push notification permissions');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error registering for notifications:', error);
            return false;
        }
    };

    const scheduleNotifications = async () => {
        try {
            // Cancel any existing notifications first
            await Notifications.cancelAllScheduledNotificationsAsync();

            // Schedule notifications for every 15 minutes for the next 24 hours
            const notificationIds = [];
            for (let i = 1; i <= 96; i++) { // 96 slots in 24 hours
                const trigger = {
                    seconds: i * INTERVAL_MINUTES * 60,
                    repeats: false,
                };

                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '⏰ Time Check-in',
                        body: 'What are you doing right now?',
                        sound: true,
                        priority: Notifications.AndroidNotificationPriority.HIGH,
                    },
                    trigger,
                });

                notificationIds.push(id);
            }

            console.log(`Scheduled ${notificationIds.length} notifications`);
            return notificationIds;
        } catch (error) {
            console.error('Error scheduling notifications:', error);
        }
    };

    const cancelAllNotifications = async () => {
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            console.log('All notifications cancelled');
        } catch (error) {
            console.error('Error cancelling notifications:', error);
        }
    };

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            setHasSeenOnboarding(true);
        } catch (error) {
            console.error('Error saving onboarding:', error);
        }
    };

    const goBackToIntro = () => {
        Alert.alert(
            'Return to Welcome',
            'Go back to the welcome screen?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Go Back',
                    onPress: async () => {
                        await AsyncStorage.removeItem(ONBOARDING_KEY);
                        setHasSeenOnboarding(false);
                    },
                },
            ]
        );
    };

    const getMidnightToday = () => {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        return midnight;
    };

    const getMidnightTomorrow = () => {
        const midnight = getMidnightToday();
        midnight.setDate(midnight.getDate() + 1);
        return midnight;
    };

    const generateTimeSlots = () => {
        const slots = [];
        const startTime = getMidnightToday();
        const endTime = getMidnightTomorrow();

        let current = new Date(startTime);

        while (current < endTime) {
            slots.push({
                time: new Date(current),
                activity: null,
                isAuto: false,
            });
            current = new Date(current.getTime() + INTERVAL_MINUTES * 60 * 1000);
        }

        return slots;
    };

    const getCurrentSlotIndex = () => {
        const now = new Date();
        const midnight = getMidnightToday();
        const minutesSinceMidnight = Math.floor((now - midnight) / (60 * 1000));
        const slotIndex = Math.floor(minutesSinceMidnight / INTERVAL_MINUTES);
        return slotIndex;
    };

    const checkCurrentSlot = () => {
        const slotIndex = getCurrentSlotIndex();
        setCurrentSlotIndex(slotIndex);

        if (slotIndex >= 0 && slotIndex < timeSlots.length) {
            const slot = timeSlots[slotIndex];

            // If current slot is empty, prompt or auto-fill
            if (!slot.activity) {
                if (isSleepMode) {
                    // Auto-fill with Sleeping
                    updateSlotActivity(slotIndex, 'Sleeping', true);
                } else if (!showPrompt && !editingSlot) {
                    // Show prompt for current slot
                    setEditingSlot(slotIndex);
                    setCurrentActivity('');
                    setShowPrompt(true);
                }
            }
        }
    };

    const loadData = async () => {
        try {
            const savedData = await AsyncStorage.getItem(STORAGE_KEY);

            // Generate fresh slots
            let slots = generateTimeSlots();

            if (savedData) {
                // Load saved data - don't care about the day
                const data = JSON.parse(savedData);
                setIsTracking(data.isTracking || false);
                setTrackingDate(data.trackingDate || getMidnightToday().toISOString());

                // Merge saved activities into slots
                if (data.timeSlots) {
                    slots = slots.map((slot, index) => {
                        const savedSlot = data.timeSlots[index];
                        if (savedSlot && savedSlot.activity) {
                            return {
                                ...slot,
                                activity: savedSlot.activity,
                                isAuto: savedSlot.isAuto || false,
                            };
                        }
                        return slot;
                    });
                }
            } else {
                setTrackingDate(getMidnightToday().toISOString());
            }

            setTimeSlots(slots);
        } catch (error) {
            console.error('Error loading data:', error);
            setTimeSlots(generateTimeSlots());
            setTrackingDate(getMidnightToday().toISOString());
        }
    };

    const saveData = async (slots, tracking, date = null) => {
        try {
            const data = {
                isTracking: tracking,
                trackingDate: date || trackingDate || getMidnightToday().toISOString(),
                timeSlots: slots.map(slot => ({
                    time: slot.time.toISOString(),
                    activity: slot.activity,
                    isAuto: slot.isAuto,
                })),
            };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    };

    const startTracking = async () => {
        // Request notification permissions first
        const hasPermission = await registerForPushNotificationsAsync();

        if (!hasPermission) {
            Alert.alert(
                'Notifications Required',
                'Please enable notifications to receive 15-minute reminders for time tracking.',
                [{ text: 'OK' }]
            );
            return;
        }

        setIsTracking(true);
        setShowSummary(false);

        // Save the day we started tracking
        const today = getMidnightToday();
        setTrackingDate(today.toISOString());
        await AsyncStorage.setItem(TRACKING_START_DAY_KEY, today.toISOString());

        saveData(timeSlots, true, today.toISOString());

        // Schedule notifications
        await scheduleNotifications();

        // Check if we need to prompt for current slot
        checkCurrentSlot();
    };

    const stopTracking = async () => {
        Alert.alert(
            'Stop Tracking',
            'This will disable notifications but keep your data. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Stop',
                    onPress: async () => {
                        setIsTracking(false);
                        await cancelAllNotifications();

                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                        }

                        saveData(timeSlots, false);
                    },
                },
            ]
        );
    };

    const viewSummary = () => {
        setShowSummary(true);
    };

    const updateSlotActivity = (slotIndex, activity, isAuto = false) => {
        const updatedSlots = [...timeSlots];
        updatedSlots[slotIndex] = {
            ...updatedSlots[slotIndex],
            activity: activity,
            isAuto: isAuto,
        };
        setTimeSlots(updatedSlots);
        saveData(updatedSlots, isTracking);
    };

    const getUniqueActivities = () => {
        const activities = new Set();
        timeSlots.forEach(slot => {
            if (slot.activity && slot.activity.trim()) {
                activities.add(slot.activity.trim());
            }
        });
        return Array.from(activities).sort();
    };

    const filterActivities = (searchText) => {
        if (!searchText || searchText.trim() === '') {
            setFilteredActivities(getUniqueActivities());
            return;
        }

        const search = searchText.toLowerCase().trim();
        const uniqueActivities = getUniqueActivities();
        const filtered = uniqueActivities.filter(activity =>
            activity.toLowerCase().includes(search)
        );
        setFilteredActivities(filtered);
    };

    const submitActivity = () => {
        const activity = currentActivity.trim();

        if (!activity) {
            Alert.alert('Error', 'Please enter an activity');
            return;
        }

        if (editingSlot !== null) {
            updateSlotActivity(editingSlot, activity, false);
        }

        setCurrentActivity('');
        setShowPrompt(false);
        setEditingSlot(null);
        setShowSuggestions(false);
    };

    const selectSuggestion = (activity) => {
        setCurrentActivity(activity);
        setShowSuggestions(false);
    };

    const handleSlotPress = (index) => {
        const now = new Date();
        const slotTime = timeSlots[index].time;

        // Don't allow editing future slots
        if (slotTime > now) {
            Alert.alert('Cannot Edit', 'You cannot edit future time slots.');
            return;
        }

        // Allow editing current or past slots
        setEditingSlot(index);
        setCurrentActivity(timeSlots[index].activity || '');
        setShowPrompt(true);

        // Initialize suggestions
        const uniqueActivities = getUniqueActivities();
        setFilteredActivities(uniqueActivities);
        setShowSuggestions(uniqueActivities.length > 0);
    };

    const calculateSummary = () => {
        const activityCounts = {};
        const filledSlots = timeSlots.filter(slot => slot.activity);

        filledSlots.forEach((slot) => {
            const activityName = slot.activity;
            activityCounts[activityName] = (activityCounts[activityName] || 0) + 1;
        });

        const total = filledSlots.length;
        const summary = Object.entries(activityCounts).map(([activity, count]) => ({
            activity,
            count,
            percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0,
            minutes: count * INTERVAL_MINUTES,
        }));

        // Sort by count descending
        return summary.sort((a, b) => b.count - a.count);
    };

    const resetDay = async () => {
        Alert.alert(
            'Reset Day',
            'This will clear all tracking data and start fresh. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Cancel all notifications
                            await cancelAllNotifications();

                            // Clear intervals
                            if (intervalRef.current) {
                                clearInterval(intervalRef.current);
                            }

                            // Clear all storage keys
                            await AsyncStorage.removeItem(STORAGE_KEY);
                            await AsyncStorage.removeItem(TRACKING_START_DAY_KEY);
                            await AsyncStorage.removeItem(CURRENT_DAY_KEY);

                            // Generate completely fresh slots
                            const freshSlots = generateTimeSlots();

                            // Reset all state to initial values
                            setTimeSlots(freshSlots);
                            setIsTracking(false);
                            setShowSummary(false);
                            setIsSleepMode(false);
                            setEditingSlot(null);
                            setCurrentActivity('');
                            setShowPrompt(false);
                            setShowSuggestions(false);
                            setFilteredActivities([]);
                            setCurrentSlotIndex(null);
                            setTrackingDate(getMidnightToday().toISOString());

                            // Force a re-render
                            setTimeout(() => {
                                console.log('Reset complete, slots:', freshSlots.filter(s => s.activity).length);
                            }, 100);

                            Alert.alert('Success', 'All tracking data has been cleared!');
                        } catch (error) {
                            console.error('Error resetting day:', error);
                            Alert.alert('Error', 'Failed to reset: ' + error.message);
                        }
                    },
                },
            ]
        );
    };

    const formatTime = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatTimeRange = (date) => {
        const start = new Date(date);
        const end = new Date(start.getTime() + INTERVAL_MINUTES * 60 * 1000);
        return `${formatTime(start)} - ${formatTime(end)}`;
    };

    const getSlotStatus = (slot, index) => {
        const now = new Date();
        const slotTime = slot.time;
        const slotEndTime = new Date(slotTime.getTime() + INTERVAL_MINUTES * 60 * 1000);

        if (slotTime > now) {
            return 'future';
        } else if (now >= slotTime && now < slotEndTime) {
            return 'current';
        } else if (slot.activity) {
            return 'filled';
        } else {
            return 'empty';
        }
    };

    const getFilledSlotsCount = () => {
        return timeSlots.filter(slot => slot.activity).length;
    };

    const getEmptySlotsCount = () => {
        const now = new Date();
        return timeSlots.filter(slot => !slot.activity && slot.time <= now).length;
    };

    const openDevNautsLinkedIn = () => {
        Linking.openURL('https://www.linkedin.com/company/devnauts');
    };

    const openBookLink = () => {
        Linking.openURL('https://www.amazon.com/Buy-Back-Your-Time-Unstuck/dp/059342297X');
    };

    // Onboarding Screen
    if (!hasSeenOnboarding) {
        return (
            <View style={styles.onboardingContainer}>
                <StatusBar style="light" translucent={false} />
                <ScrollView contentContainerStyle={styles.onboardingScroll}>
                    <TouchableOpacity
                        style={styles.brandingHeader}
                        onPress={openDevNautsLinkedIn}
                        activeOpacity={0.7}
                    >
                        <Image
                            source={require('./assets/logo-without-text.png')}
                            style={styles.smallLogo}
                            resizeMode="contain"
                        />
                        <Text style={styles.poweredByText}>Powered by DevNauts</Text>
                    </TouchableOpacity>

                    <View style={styles.onboardingHeader}>
                        <Text style={styles.onboardingTitle}>TimeBack</Text>
                        <Text style={styles.onboardingSubtitle}>Activity Tracker</Text>
                    </View>

                    <View style={styles.onboardingContent}>
                        <View style={styles.featureBlock}>
                            <Text style={styles.featureIcon}>⏰</Text>
                            <Text style={styles.featureTitle}>Track Every 15 Minutes</Text>
                            <Text style={styles.featureText}>
                                Log your activities in 15-minute blocks throughout the day. See exactly where your time goes.
                            </Text>
                        </View>

                        <View style={styles.featureBlock}>
                            <Text style={styles.featureIcon}>📊</Text>
                            <Text style={styles.featureTitle}>Understand Your Day</Text>
                            <Text style={styles.featureText}>
                                Get detailed insights and percentages showing how you spend your time. Identify what's worth your attention.
                            </Text>
                        </View>

                        <View style={styles.featureBlock}>
                            <Text style={styles.featureIcon}>🎯</Text>
                            <Text style={styles.featureTitle}>Make Better Decisions</Text>
                            <Text style={styles.featureText}>
                                Use data to decide what to delegate, automate, or eliminate. Focus on your highest-value activities.
                            </Text>
                        </View>

                        <View style={styles.philosophyBox}>
                            <Text style={styles.philosophyQuote}>
                                "You can't buy back your time, but you can buy back your life by understanding where your time goes."
                            </Text>
                            <Text style={styles.philosophyAuthor}>- Time Audit Methodology</Text>
                        </View>
                    </View>

                    <View style={styles.onboardingActions}>
                        <TouchableOpacity
                            style={styles.aboutLink}
                            onPress={() => {
                                completeOnboarding();
                                setShowAbout(true);
                            }}
                        >
                            <Text style={styles.aboutLinkText}>Learn About This Method →</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.getStartedButton}
                            onPress={completeOnboarding}
                        >
                            <Text style={styles.getStartedButtonText}>Get Started</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // About/Inspiration Screen
    if (showAbout) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" translucent={false} />
                <View style={styles.aboutHeader}>
                    <TouchableOpacity
                        style={styles.backIconButton}
                        onPress={() => setShowAbout(false)}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goBackToIntro} activeOpacity={0.7}>
                        <Text style={styles.aboutHeaderTitle}>The Methodology</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.devnautsBranding}
                        onPress={openDevNautsLinkedIn}
                        activeOpacity={0.7}
                    >
                        <Image
                            source={require('./assets/logo-without-text.png')}
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
                        <View>
                            <Text style={styles.poweredByHeader}>Powered by</Text>
                            <Text style={styles.devnautsHeader}>DevNauts</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.aboutContainer} contentContainerStyle={styles.aboutContent}>
                    <Text style={styles.aboutTitle}>TimeBack Methodology</Text>

                    <View style={styles.aboutSection}>
                        <Text style={styles.aboutSectionTitle}>The Concept</Text>
                        <Text style={styles.aboutText}>
                            The foundation of "buying back your time" starts with understanding where your time actually goes.
                            Most entrepreneurs and professionals operate on intuition rather than data when it comes to their time.
                        </Text>
                        <Text style={styles.aboutText}>
                            This app implements a time audit system that tracks your activities in 15-minute increments throughout
                            the day. This granular tracking reveals patterns and insights that are invisible when you're in the
                            moment.
                        </Text>
                    </View>

                    <View style={styles.aboutSection}>
                        <Text style={styles.aboutSectionTitle}>The 4 D's Framework</Text>
                        <Text style={styles.aboutText}>
                            After tracking your time, you can analyze each activity through the lens of four decisions:
                        </Text>
                        <View style={styles.frameworkList}>
                            <View style={styles.frameworkItem}>
                                <Text style={styles.frameworkNumber}>1</Text>
                                <View style={styles.frameworkContent}>
                                    <Text style={styles.frameworkTitle}>Delete</Text>
                                    <Text style={styles.frameworkDesc}>Tasks that don't move the needle</Text>
                                </View>
                            </View>
                            <View style={styles.frameworkItem}>
                                <Text style={styles.frameworkNumber}>2</Text>
                                <View style={styles.frameworkContent}>
                                    <Text style={styles.frameworkTitle}>Delegate</Text>
                                    <Text style={styles.frameworkDesc}>Tasks others can do 80% as well</Text>
                                </View>
                            </View>
                            <View style={styles.frameworkItem}>
                                <Text style={styles.frameworkNumber}>3</Text>
                                <View style={styles.frameworkContent}>
                                    <Text style={styles.frameworkTitle}>Automate</Text>
                                    <Text style={styles.frameworkDesc}>Recurring tasks that can be systematized</Text>
                                </View>
                            </View>
                            <View style={styles.frameworkItem}>
                                <Text style={styles.frameworkNumber}>4</Text>
                                <View style={styles.frameworkContent}>
                                    <Text style={styles.frameworkTitle}>Do</Text>
                                    <Text style={styles.frameworkDesc}>Your highest-value activities only you can do</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.aboutSection}>
                        <Text style={styles.aboutSectionTitle}>How to Use This Data</Text>
                        <Text style={styles.aboutText}>
                            After tracking for at least one full day, review your summary. Ask yourself:
                        </Text>
                        <Text style={styles.bulletPoint}>• What percentage of time is spent in your zone of genius?</Text>
                        <Text style={styles.bulletPoint}>• Which activities could be delegated to others?</Text>
                        <Text style={styles.bulletPoint}>• What tasks are draining your energy without adding value?</Text>
                        <Text style={styles.bulletPoint}>• Where are you being reactive instead of proactive?</Text>
                    </View>

                    <View style={styles.aboutSection}>
                        <Text style={styles.aboutSectionTitle}>The Goal</Text>
                        <Text style={styles.aboutText}>
                            The ultimate goal isn't just to track time—it's to reclaim it. Use the insights from this audit
                            to make strategic decisions about hiring, delegation, and elimination. Every hour you buy back
                            is an hour you can reinvest in high-leverage activities that truly move your business and life forward.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.inspirationBox}
                        onPress={openBookLink}
                        activeOpacity={0.8}
                    >
                        <View style={styles.inspirationContent}>
                            <Image
                                source={require('./assets/buybackyourtime.avif')}
                                style={styles.bookCover}
                                resizeMode="cover"
                            />
                            <View style={styles.inspirationTextContainer}>
                                <Text style={styles.inspirationTitle}>Inspired by</Text>
                                <Text style={styles.inspirationText}>
                                    Dan Martell's "Buy Back Your Time" methodology and productivity principles for entrepreneurs
                                    who want to scale their impact without sacrificing their freedom.
                                </Text>
                                <Text style={styles.bookLinkText}>📖 View Book on Amazon →</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.devnautsLinkBox}
                        onPress={openDevNautsLinkedIn}
                        activeOpacity={0.7}
                    >
                        <View style={styles.devnautsLinkContent}>
                            <Image
                                source={require('./assets/logo-without-text.png')}
                                style={styles.devnautsLinkLogo}
                                resizeMode="contain"
                            />
                            <View style={styles.devnautsLinkTextContainer}>
                                <Text style={styles.devnautsLinkTitle}>Built by DevNauts</Text>
                                <Text style={styles.devnautsLinkSubtitle}>Visit our LinkedIn →</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.closeAboutButton}
                        onPress={() => setShowAbout(false)}
                    >
                        <Text style={styles.closeAboutButtonText}>Start Tracking</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // Summary Screen
    if (showSummary) {
        const summary = calculateSummary();
        const filledCount = getFilledSlotsCount();
        const totalPastSlots = timeSlots.filter(slot => slot.time <= new Date()).length;
        const completionRate = totalPastSlots > 0 ? ((filledCount / totalPastSlots) * 100).toFixed(1) : 0;

        return (
            <View style={styles.container}>
                <StatusBar style="light" translucent={false} />
                <View style={styles.summaryHeader}>
                    <TouchableOpacity
                        style={styles.backIconButton}
                        onPress={() => setShowSummary(false)}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goBackToIntro} activeOpacity={0.7}>
                        <Text style={styles.summaryHeaderTitle}>
                            Audit - {trackingDate ? new Date(trackingDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                            }) : 'Today'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.devnautsBranding}
                        onPress={openDevNautsLinkedIn}
                        activeOpacity={0.7}
                    >
                        <Image
                            source={require('./assets/logo-without-text.png')}
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
                        <View>
                            <Text style={styles.poweredByHeader}>Powered by</Text>
                            <Text style={styles.devnautsHeader}>DevNauts</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.summaryContainer} contentContainerStyle={styles.summaryContent}>
                    <Text style={styles.summarySubtitle}>
                        {filledCount} of {totalPastSlots} slots tracked ({completionRate}%)
                    </Text>

                    <View style={styles.summaryList}>
                        {summary.map((item, index) => (
                            <View key={index} style={styles.summaryItem}>
                                <View style={styles.summaryItemHeader}>
                                    <Text style={styles.activityName}>{item.activity}</Text>
                                    <Text style={styles.percentage}>{item.percentage}%</Text>
                                </View>
                                <View style={styles.progressBarContainer}>
                                    <View
                                        style={[
                                            styles.progressBar,
                                            { width: `${item.percentage}%` }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.countText}>
                                    {item.minutes} minutes ({item.count} slot{item.count !== 1 ? 's' : ''})
                                </Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.backToMainButton}
                        onPress={() => setShowSummary(false)}
                    >
                        <Text style={styles.backToMainButtonText}>Back to Timeline</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // Main App Screen
    return (
        <View style={styles.container}>
            <StatusBar style="light" translucent={false} />

            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.headerCenter}>
                        <TouchableOpacity onPress={() => setShowAbout(true)} activeOpacity={0.7}>
                            <Text style={styles.title}>TimeBack</Text>
                        </TouchableOpacity>
                        <Text style={styles.subtitle}>
                            {trackingDate ? new Date(trackingDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            }) : getMidnightToday().toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.devnautsBrandingMain}
                        onPress={openDevNautsLinkedIn}
                        activeOpacity={0.7}
                    >
                        <Image
                            source={require('./assets/logo-without-text.png')}
                            style={styles.headerLogoMain}
                            resizeMode="contain"
                        />
                        <View>
                            <Text style={styles.poweredByHeader}>Powered by</Text>
                            <Text style={styles.devnautsHeader}>DevNauts</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainContainer}>
                <View style={styles.trackingToggleCard}>
                    <View style={styles.trackingToggleHeader}>
                        <View style={styles.trackingToggleContent}>
                            <Text style={styles.trackingToggleLabel}>Tracking Mode</Text>
                            <Text style={styles.trackingToggleDescription}>
                                Enable to start tracking your day (push notifications every 15 minutes)
                            </Text>
                        </View>
                        <Switch
                            value={isTracking}
                            onValueChange={(value) => {
                                if (value) {
                                    startTracking();
                                } else {
                                    stopTracking();
                                }
                            }}
                            trackColor={{ false: '#d1d5db', true: COLORS.accent }}
                            thumbColor={isTracking ? COLORS.primary : '#f3f4f6'}
                        />
                    </View>
                </View>

                {!isTracking ? (
                    <View style={styles.disabledInfoCard}>
                        <Text style={styles.disabledInfoText}>
                            Enable tracking mode to start logging your activities and receive reminders every 15 minutes.
                        </Text>
                    </View>
                ) : null}

                {!isTracking && getFilledSlotsCount() > 0 && (
                    <View style={styles.startContainer}>
                        <TouchableOpacity style={styles.viewSummaryButton} onPress={viewSummary}>
                            <Text style={styles.viewSummaryButtonText}>View Summary</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {isTracking && (
                <View style={styles.trackingContainer}>
                    <View style={styles.statusCard}>
                        <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>Tracking Mode:</Text>
                            <View style={styles.statusBadge}>
                                <View style={styles.statusDot} />
                                <Text style={styles.statusText}>Active</Text>
                            </View>
                        </View>

                        <View style={styles.notificationInfo}>
                            <Text style={styles.notificationText}>
                                🔔 Push notifications enabled - You'll receive reminders every 15 minutes
                            </Text>
                        </View>

                        <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>Tracked:</Text>
                            <Text style={styles.statusValue}>{getFilledSlotsCount()} / {timeSlots.length}</Text>
                        </View>

                        <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>Missing:</Text>
                            <Text style={[styles.statusValue, getEmptySlotsCount() > 0 && styles.warningText]}>
                                {getEmptySlotsCount()}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.sleepModeContainer}>
                        <View style={styles.sleepModeContent}>
                            <Text style={styles.sleepModeLabel}>Sleep Mode</Text>
                            <Text style={styles.sleepModeDescription}>
                                Auto-fill current slots with "Sleeping"
                            </Text>
                        </View>
                        <Switch
                            value={isSleepMode}
                            onValueChange={setIsSleepMode}
                            trackColor={{ false: '#d1d5db', true: COLORS.accent }}
                            thumbColor={isSleepMode ? COLORS.primary : '#f3f4f6'}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.viewSummaryButton2}
                        onPress={viewSummary}
                    >
                        <Text style={styles.viewSummaryButton2Text}>View Summary</Text>
                    </TouchableOpacity>

                    <View style={styles.bottomLinks}>
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={resetDay}
                        >
                            <Text style={styles.linkText}>Reset Day</Text>
                        </TouchableOpacity>

                        <Text style={styles.linkSeparator}>•</Text>

                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={goBackToIntro}
                        >
                            <Text style={styles.linkText}>View Welcome</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.timelineContainer}>
                        <Text style={styles.timelineTitle}>Timeline</Text>
                        <ScrollView style={styles.timeline}>
                            {timeSlots.map((slot, index) => {
                                const status = getSlotStatus(slot, index);
                                const isCurrent = status === 'current';
                                const isFuture = status === 'future';
                                const isFilled = status === 'filled';
                                const isEmpty = status === 'empty';

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.timeSlot,
                                            isCurrent && styles.currentSlot,
                                            isFilled && styles.filledSlot,
                                            isEmpty && styles.emptySlot,
                                            isFuture && styles.futureSlot,
                                        ]}
                                        onPress={() => handleSlotPress(index)}
                                        disabled={isFuture}
                                    >
                                        <View style={styles.slotHeader}>
                                            <Text style={[
                                                styles.slotTime,
                                                isCurrent && styles.currentSlotText,
                                                isFuture && styles.futureSlotText,
                                            ]}>
                                                {formatTimeRange(slot.time)}
                                            </Text>
                                            {isCurrent && (
                                                <View style={styles.currentBadge}>
                                                    <Text style={styles.currentBadgeText}>NOW</Text>
                                                </View>
                                            )}
                                            {isFuture && (
                                                <View style={styles.futureBadge}>
                                                    <Text style={styles.futureBadgeText}>FUTURE</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[
                                            styles.slotActivity,
                                            !slot.activity && styles.emptySlotText,
                                            isFuture && styles.futureSlotText,
                                        ]}>
                                            {slot.activity || (isFuture ? 'Not available yet' : 'Tap to add activity')}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* Activity Prompt Modal */}
            <Modal
                visible={showPrompt}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {editingSlot !== null && timeSlots[editingSlot]
                                ? (editingSlot === currentSlotIndex ? 'Current Activity' : 'Edit Activity')
                                : 'What are you doing?'}
                        </Text>
                        {editingSlot !== null && timeSlots[editingSlot] && (
                            <Text style={styles.modalTime}>
                                {formatTimeRange(timeSlots[editingSlot].time)}
                            </Text>
                        )}

                        <TextInput
                            style={styles.input}
                            placeholder="Enter your activity..."
                            value={currentActivity}
                            onChangeText={(text) => {
                                setCurrentActivity(text);
                                filterActivities(text);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => {
                                const uniqueActivities = getUniqueActivities();
                                if (uniqueActivities.length > 0) {
                                    filterActivities(currentActivity);
                                    setShowSuggestions(true);
                                }
                            }}
                            autoFocus={true}
                            multiline={false}
                            returnKeyType="done"
                            onSubmitEditing={submitActivity}
                        />

                        {showSuggestions && filteredActivities.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                                <Text style={styles.suggestionsTitle}>
                                    {currentActivity.trim()
                                        ? `Recent activities matching '${currentActivity.trim()}'`
                                        : 'Recent activities'}
                                </Text>
                                <ScrollView
                                    style={styles.suggestionsList}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {filteredActivities.map((activity, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.suggestionItem}
                                            onPress={() => selectSuggestion(activity)}
                                        >
                                            <Text style={styles.suggestionText}>{activity}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowPrompt(false);
                                    setEditingSlot(null);
                                    setCurrentActivity('');
                                    setShowSuggestions(false);
                                }}
                            >
                                <Text style={styles.cancelButtonText}>
                                    {editingSlot === currentSlotIndex ? 'Skip' : 'Cancel'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.submitButton,
                                    styles.submitButtonHalf,
                                    !currentActivity.trim() && styles.submitButtonDisabled
                                ]}
                                onPress={submitActivity}
                                disabled={!currentActivity.trim()}
                            >
                                <Text style={[
                                    styles.submitButtonText,
                                    !currentActivity.trim() && styles.submitButtonTextDisabled
                                ]}>
                                    {timeSlots[editingSlot]?.activity ? 'Update' : 'Submit'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.dark,
    },
    // Onboarding Styles
    onboardingContainer: {
        flex: 1,
        backgroundColor: COLORS.dark,
    },
    onboardingScroll: {
        flexGrow: 1,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: 40,
    },
    brandingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        backgroundColor: COLORS.cardBg,
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
    },
    smallLogo: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
    poweredByText: {
        fontSize: 14,
        color: COLORS.white,
        fontWeight: '600',
    },
    onboardingHeader: {
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 40,
        alignItems: 'center',
    },
    onboardingTitle: {
        fontSize: 36,
        fontWeight: 'bold',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    onboardingSubtitle: {
        fontSize: 20,
        color: COLORS.primary,
        fontWeight: '600',
        textAlign: 'center',
    },
    onboardingContent: {
        paddingHorizontal: 24,
    },
    featureBlock: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    featureIcon: {
        fontSize: 48,
        marginBottom: 12,
        textAlign: 'center',
    },
    featureTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    featureText: {
        fontSize: 14,
        color: COLORS.textLight,
        lineHeight: 22,
        textAlign: 'center',
    },
    philosophyBox: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 24,
        marginTop: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    philosophyQuote: {
        fontSize: 16,
        fontStyle: 'italic',
        color: COLORS.text,
        lineHeight: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    philosophyAuthor: {
        fontSize: 14,
        color: COLORS.primary,
        textAlign: 'center',
        fontWeight: '600',
    },
    onboardingActions: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    aboutLink: {
        marginBottom: 16,
        alignItems: 'center',
    },
    aboutLinkText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    getStartedButton: {
        backgroundColor: COLORS.purple,
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: COLORS.purple,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    getStartedButtonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    // About Screen Styles
    aboutHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: COLORS.cardBg,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
    },
    backIconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        fontSize: 28,
        color: COLORS.text,
    },
    aboutHeaderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        textDecorationLine: 'underline',
        textDecorationColor: COLORS.textLight,
    },
    devnautsBranding: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerLogo: {
        width: 40,
        height: 40,
    },
    poweredByHeader: {
        fontSize: 11,
        color: COLORS.textLight,
        fontWeight: '500',
    },
    devnautsHeader: {
        fontSize: 18,
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    aboutContainer: {
        flex: 1,
    },
    aboutContent: {
        padding: 24,
    },
    aboutTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 24,
    },
    aboutSection: {
        marginBottom: 32,
    },
    aboutSectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 12,
    },
    aboutText: {
        fontSize: 16,
        color: COLORS.textLight,
        lineHeight: 26,
        marginBottom: 12,
    },
    bulletPoint: {
        fontSize: 16,
        color: COLORS.textLight,
        lineHeight: 26,
        marginBottom: 8,
        paddingLeft: 8,
    },
    frameworkList: {
        marginTop: 16,
    },
    frameworkItem: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBg,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    frameworkNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.primary,
        width: 40,
    },
    frameworkContent: {
        flex: 1,
    },
    frameworkTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    frameworkDesc: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    inspirationBox: {
        backgroundColor: COLORS.cardBg,
        padding: 20,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    inspirationContent: {
        flexDirection: 'row',
        gap: 16,
    },
    bookCover: {
        width: 100,
        height: 100,
        borderRadius: 8,
        backgroundColor: COLORS.cardBorder,
    },
    inspirationTextContainer: {
        flex: 1,
    },
    inspirationTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 8,
    },
    inspirationText: {
        fontSize: 14,
        color: COLORS.textLight,
        lineHeight: 22,
        marginBottom: 12,
    },
    bookLinkText: {
        fontSize: 14,
        color: COLORS.secondary,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    devnautsLinkBox: {
        backgroundColor: COLORS.cardBg,
        padding: 20,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 2,
        borderColor: COLORS.secondary,
    },
    devnautsLinkContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    devnautsLinkLogo: {
        width: 100,
        height: 100,
    },
    devnautsLinkTextContainer: {
        flex: 1,
    },
    devnautsLinkTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 8,
    },
    devnautsLinkSubtitle: {
        fontSize: 14,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    closeAboutButton: {
        backgroundColor: COLORS.purple,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: COLORS.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 4,
    },
    closeAboutButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    // Header Styles
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: COLORS.cardBg,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textLight,
        fontWeight: '500',
    },
    devnautsBrandingMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerLogoMain: {
        width: 40,
        height: 40,
    },
    mainContainer: {
        flex: 1,
        padding: 24,
    },
    trackingToggleCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    trackingToggleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trackingToggleContent: {
        flex: 1,
        marginRight: 16,
    },
    trackingToggleLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    trackingToggleDescription: {
        fontSize: 13,
        color: COLORS.textLight,
        lineHeight: 20,
    },
    disabledInfoCard: {
        backgroundColor: COLORS.cardBg,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    disabledInfoText: {
        fontSize: 14,
        color: COLORS.textLight,
        lineHeight: 22,
        textAlign: 'center',
    },
    startContainer: {
        alignItems: 'center',
    },
    infoCard: {
        backgroundColor: COLORS.cardBg,
        padding: 28,
        borderRadius: 16,
        marginBottom: 32,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    infoTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    infoText: {
        fontSize: 15,
        color: COLORS.textLight,
        lineHeight: 22,
        marginBottom: 16,
        textAlign: 'center',
    },
    infoHighlight: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
        textAlign: 'center',
        backgroundColor: COLORS.cardBorder,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.primary,
        marginTop: 8,
        lineHeight: 20,
    },
    startButton: {
        backgroundColor: COLORS.purple,
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: 12,
        shadowColor: COLORS.purple,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    startButtonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    viewSummaryButton: {
        marginTop: 20,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: COLORS.primary,
        backgroundColor: COLORS.cardBg,
    },
    viewSummaryButtonText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    trackingContainer: {
        flex: 1,
        padding: 16,
    },
    statusCard: {
        backgroundColor: COLORS.cardBg,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.success,
    },
    notificationInfo: {
        marginTop: 12,
        padding: 12,
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.secondary,
    },
    notificationText: {
        fontSize: 12,
        color: COLORS.secondary,
        lineHeight: 18,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    statusLabel: {
        fontSize: 14,
        color: COLORS.textLight,
        fontWeight: '500',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.success,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        color: COLORS.success,
        fontWeight: '600',
    },
    statusValue: {
        fontSize: 16,
        color: COLORS.text,
        fontWeight: '600',
    },
    warningText: {
        color: COLORS.warning,
    },
    sleepModeContainer: {
        backgroundColor: COLORS.cardBg,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    sleepModeContent: {
        flex: 1,
    },
    sleepModeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 2,
    },
    sleepModeDescription: {
        fontSize: 12,
        color: COLORS.textLight,
    },
    viewSummaryButton2: {
        backgroundColor: COLORS.purple,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: COLORS.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
    },
    viewSummaryButton2Text: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '600',
    },
    bottomLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 16,
        gap: 12,
    },
    linkButton: {
        paddingVertical: 8,
    },
    linkText: {
        color: COLORS.textLight,
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    linkSeparator: {
        color: COLORS.textLight,
        fontSize: 13,
    },
    timelineContainer: {
        flex: 1,
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    timelineTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    timeline: {
        flex: 1,
    },
    timeSlot: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.light,
    },
    currentSlot: {
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
        borderColor: COLORS.secondary,
        borderWidth: 2,
    },
    filledSlot: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: COLORS.success,
    },
    emptySlot: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: COLORS.warning,
    },
    futureSlot: {
        backgroundColor: COLORS.cardBg,
        borderColor: COLORS.cardBorder,
        opacity: 0.5,
    },
    slotHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    slotTime: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textLight,
    },
    currentSlotText: {
        color: COLORS.secondary,
    },
    futureSlotText: {
        color: '#9ca3af',
    },
    currentBadge: {
        backgroundColor: COLORS.blue,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    currentBadgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: 'bold',
    },
    futureBadge: {
        backgroundColor: COLORS.cardBorder,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    futureBadgeText: {
        color: COLORS.textLight,
        fontSize: 10,
        fontWeight: 'bold',
    },
    slotActivity: {
        fontSize: 14,
        color: COLORS.text,
    },
    emptySlotText: {
        color: COLORS.warning,
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        borderWidth: 2,
        borderColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
        textAlign: 'center',
    },
    modalTime: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: COLORS.light,
        color: COLORS.text,
    },
    suggestionsContainer: {
        maxHeight: 200,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: 8,
        backgroundColor: COLORS.light,
        overflow: 'hidden',
    },
    suggestionsTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textLight,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: COLORS.cardBg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    suggestionsList: {
        maxHeight: 160,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
        backgroundColor: COLORS.light,
    },
    suggestionText: {
        fontSize: 14,
        color: COLORS.text,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: COLORS.cardBorder,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: COLORS.textLight,
        fontSize: 16,
        fontWeight: '600',
    },
    submitButton: {
        flex: 1,
        backgroundColor: COLORS.purple,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: COLORS.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonHalf: {
        flex: 1,
    },
    submitButtonDisabled: {
        backgroundColor: COLORS.cardBorder,
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    submitButtonTextDisabled: {
        color: COLORS.textLight,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: COLORS.cardBg,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
    },
    summaryHeaderTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
        textDecorationLine: 'underline',
        textDecorationColor: COLORS.textLight,
    },
    summaryContainer: {
        flex: 1,
    },
    summaryContent: {
        padding: 24,
    },
    summarySubtitle: {
        fontSize: 16,
        color: COLORS.textLight,
        marginBottom: 24,
        textAlign: 'center',
        fontWeight: '500',
    },
    summaryList: {
        marginBottom: 20,
    },
    summaryItem: {
        backgroundColor: COLORS.cardBg,
        padding: 20,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    summaryItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    activityName: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        flex: 1,
    },
    percentage: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginLeft: 12,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: COLORS.cardBorder,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 4,
    },
    countText: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    backToMainButton: {
        backgroundColor: COLORS.purple,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
        shadowColor: COLORS.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 4,
    },
    backToMainButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
});
