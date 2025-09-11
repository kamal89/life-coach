// src/hooks/index.js - Custom React Hooks
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { authAPI, goalsAPI, chatAPI, apiService, wsService } from '../services/api';
import toast from 'react-hot-toast';

// ============================================================================
// AUTHENTICATION HOOKS
// ============================================================================

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = apiService.getAuthToken();
      
      if (!token || !apiService.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await authAPI.getProfile();
        setUser(userData.user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        apiService.clearAuthToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useMutation(authAPI.login, {
    onSuccess: (data) => {
      apiService.setAuthToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      toast.success(`Welcome back, ${data.user.name}!`);
    },
    onError: (error) => {
      toast.error(error.message || 'Login failed');
    },
  });

  const register = useMutation(authAPI.register, {
    onSuccess: (data) => {
      apiService.setAuthToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      toast.success(`Welcome to AI Life Coach, ${data.user.name}!`);
    },
    onError: (error) => {
      toast.error(error.message || 'Registration failed');
    },
  });

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      apiService.clearAuthToken();
      setUser(null);
      setIsAuthenticated(false);
      toast.success('Logged out successfully');
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
  };
};

// ============================================================================
// GOALS HOOKS
// ============================================================================

export const useGoals = (filters = {}) => {
  const queryClient = useQueryClient();

  // Fetch goals with filters
  const {
    data: goals = [],
    isLoading,
    error,
    refetch,
  } = useQuery(
    ['goals', filters],
    () => goalsAPI.getGoals(filters),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      select: (data) => data.goals,
    }
  );

  // Create goal mutation
  const createGoal = useMutation(goalsAPI.createGoal, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('goals');
      toast.success('Goal created successfully!');
      return data.goal;
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create goal');
    },
  });

  // Update goal mutation
  const updateGoal = useMutation(
    ({ id, data }) => goalsAPI.updateGoal(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('goals');
        toast.success('Goal updated successfully!');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update goal');
      },
    }
  );

  // Delete goal mutation
  const deleteGoal = useMutation(goalsAPI.deleteGoal, {
    onSuccess: () => {
      queryClient.invalidateQueries('goals');
      toast.success('Goal deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete goal');
    },
  });

  // Update progress mutation
  const updateProgress = useMutation(
    ({ id, progress, note }) => goalsAPI.updateProgress(id, progress, note),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('goals');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update progress');
      },
    }
  );

  // Add check-in mutation
  const addCheckIn = useMutation(
    ({ id, checkInData }) => goalsAPI.addCheckIn(id, checkInData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('goals');
        toast.success('Check-in added successfully!');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to add check-in');
      },
    }
  );

  // Computed values
  const statistics = useMemo(() => {
    const activeGoals = goals.filter(goal => goal.status === 'active');
    const completedGoals = goals.filter(goal => goal.status === 'completed');
    const totalProgress = activeGoals.reduce((sum, goal) => sum + goal.progress, 0);
    const averageProgress = activeGoals.length > 0 ? totalProgress / activeGoals.length : 0;

    return {
      total: goals.length,
      active: activeGoals.length,
      completed: completedGoals.length,
      averageProgress: Math.round(averageProgress),
      completionRate: goals.length > 0 ? (completedGoals.length / goals.length) * 100 : 0,
    };
  }, [goals]);

  return {
    goals,
    isLoading,
    error,
    statistics,
    refetch,
    createGoal,
    updateGoal,
    deleteGoal,
    updateProgress,
    addCheckIn,
  };
};

// ============================================================================
// CHAT HOOKS
// ============================================================================

export const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const queryClient = useQueryClient();

  // Load chat history
  const { isLoading } = useQuery(
    'chatHistory',
    () => chatAPI.getHistory({ limit: 50 }),
    {
      onSuccess: (data) => {
        setMessages(data.messages.map(msg => ({
          id: msg._id,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          metadata: msg.metadata,
        })));
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  // Send message mutation
  const sendMessage = useMutation(chatAPI.sendMessage, {
    onMutate: async ({ message }) => {
      // Optimistically add user message
      const userMessage = {
        id: `temp-${Date.now()}`,
        type: 'user',
        content: message,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);
      setIsTyping(true);
      
      return { userMessage };
    },
    onSuccess: (data, variables, context) => {
      // Replace temp message and add AI response
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== context.userMessage.id);
        return [
          ...filtered,
          {
            id: data.userMessage._id,
            type: 'user',
            content: data.userMessage.content,
            timestamp: new Date(data.userMessage.createdAt),
          },
          {
            id: data.aiMessage._id,
            type: 'ai',
            content: data.aiMessage.content,
            timestamp: new Date(data.aiMessage.createdAt),
            metadata: data.aiMessage.metadata,
          },
        ];
      });
      setIsTyping(false);
      queryClient.invalidateQueries('chatHistory');
    },
    onError: (error, variables, context) => {
      // Remove temp message and show error
      setMessages(prev => prev.filter(msg => msg.id !== context.userMessage.id));
      setIsTyping(false);
      
      const errorMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: "I apologize, but I'm having trouble responding right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      toast.error(error.message || 'Failed to send message');
    },
  });

  // Provide feedback mutation
  const provideFeedback = useMutation(
    ({ messageId, rating, feedback }) => 
      chatAPI.provideFeedback(messageId, rating, feedback),
    {
      onSuccess: () => {
        toast.success('Thank you for your feedback!');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to submit feedback');
      },
    }
  );

  // Clear chat history
  const clearHistory = useCallback(() => {
    setMessages([]);
    toast.success('Chat history cleared');
  }, []);

  return {
    messages,
    isLoading,
    isTyping,
    sendMessage,
    provideFeedback,
    clearHistory,
  };
};

// ============================================================================
// WEBSOCKET HOOKS
// ============================================================================

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    // Set up WebSocket event listeners
    wsService.on('connected', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    wsService.on('disconnected', () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    wsService.on('error', (error) => {
      setConnectionStatus('error');
      console.error('WebSocket error:', error);
    });

    // Connect if authenticated
    if (apiService.isAuthenticated()) {
      wsService.connect();
    }

    // Cleanup on unmount
    return () => {
      wsService.disconnect();
    };
  }, []);

  const sendMessage = useCallback((type, payload) => {
    wsService.send(type, payload);
  }, []);

  const subscribe = useCallback((event, callback) => {
    wsService.on(event, callback);
    
    // Return unsubscribe function
    return () => wsService.off(event, callback);
  }, []);

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    subscribe,
  };
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

// Local storage hook
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading localStorage:', error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};

// Debounce hook
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Previous value hook
export const usePrevious = (value) => {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  });
  
  return ref.current;
};

// Window size hook
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// Media query hook
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// Online status hook
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Document title hook
export const useDocumentTitle = (title, dependencies = []) => {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = title;

    return () => {
      document.title = originalTitle;
    };
  }, [title, ...dependencies]);
};

// Click outside hook
export const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, handler]);
};

// Intersection observer hook
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      setEntry(entry);
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return { ref, isIntersecting, entry };
};

// Copy to clipboard hook
export const useClipboard = (timeout = 2000) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('Copied to clipboard!');
      
      setTimeout(() => {
        setIsCopied(false);
      }, timeout);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  }, [timeout]);

  return { isCopied, copyToClipboard };
};

// Async operation hook
export const useAsync = (asyncFunction, dependencies = []) => {
  const [state, setState] = useState({
    data: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    asyncFunction()
      .then(data => {
        if (isMounted) {
          setState({ data, error: null, isLoading: false });
        }
      })
      .catch(error => {
        if (isMounted) {
          setState({ data: null, error, isLoading: false });
        }
      });

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return state;
};

// Form validation hook
export const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = useCallback((name, value) => {
    const rules = validationRules[name];
    if (!rules) return '';

    for (const rule of rules) {
      const error = rule(value, values);
      if (error) return error;
    }
    return '';
  }, [validationRules, values]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(name => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validateField, validationRules]);

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Validate field if it has been touched
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validateField, values]);

  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0 && 
                  Object.keys(touched).length > 0;

  return {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    validateForm,
    reset,
  };
};

// Dark mode hook
export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useLocalStorage('darkMode', false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, [setIsDarkMode]);

  return { isDarkMode, toggleDarkMode };
};

// Keyboard shortcut hook
export const useKeyboardShortcut = (keys, callback, options = {}) => {
  const { target = document, event = 'keydown' } = options;

  useEffect(() => {
    const targetElement = target && target.addEventListener ? target : document;

    const handleKeyDown = (event) => {
      const pressedKeys = [];
      
      if (event.ctrlKey || event.metaKey) pressedKeys.push('ctrl');
      if (event.shiftKey) pressedKeys.push('shift');
      if (event.altKey) pressedKeys.push('alt');
      pressedKeys.push(event.key.toLowerCase());

      const shortcut = pressedKeys.join('+');
      const expectedShortcut = keys.toLowerCase();

      if (shortcut === expectedShortcut) {
        event.preventDefault();
        callback(event);
      }
    };

    targetElement.addEventListener(event, handleKeyDown);

    return () => {
      targetElement.removeEventListener(event, handleKeyDown);
    };
  }, [keys, callback, target, event]);
};

// Polling hook
export const usePolling = (callback, interval, immediate = false) => {
  const intervalRef = useRef(null);
  const [isPolling, setIsPolling] = useState(false);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    setIsPolling(true);
    
    if (immediate) {
      callback();
    }

    intervalRef.current = setInterval(callback, interval);
  }, [callback, interval, immediate]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return { isPolling, startPolling, stopPolling };
};

// Timer hook
export const useTimer = (initialTime = 0, interval = 1000) => {
  const [time, setTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const start = useCallback(() => {
    if (!isRunning) {
      setIsRunning(true);
      intervalRef.current = setInterval(() => {
        setTime(prevTime => prevTime + interval / 1000);
      }, interval);
    }
  }, [isRunning, interval]);

  const pause = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isRunning]);

  const reset = useCallback(() => {
    setTime(initialTime);
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [initialTime]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    time,
    isRunning,
    start,
    pause,
    reset,
    formattedTime: formatTime(time),
  };
};

// Battery status hook
export const useBattery = () => {
  const [batteryInfo, setBatteryInfo] = useState({
    supported: false,
    loading: true,
    level: null,
    charging: null,
    chargingTime: null,
    dischargingTime: null,
  });

  useEffect(() => {
    let battery;

    const updateBatteryInfo = (battery) => {
      setBatteryInfo({
        supported: true,
        loading: false,
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      });
    };

    const handleChange = () => {
      updateBatteryInfo(battery);
    };

    if ('getBattery' in navigator) {
      navigator.getBattery().then((bat) => {
        battery = bat;
        updateBatteryInfo(battery);

        battery.addEventListener('chargingchange', handleChange);
        battery.addEventListener('levelchange', handleChange);
        battery.addEventListener('chargingtimechange', handleChange);
        battery.addEventListener('dischargingtimechange', handleChange);
      });
    } else {
      setBatteryInfo(prev => ({ ...prev, supported: false, loading: false }));
    }

    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', handleChange);
        battery.removeEventListener('levelchange', handleChange);
        battery.removeEventListener('chargingtimechange', handleChange);
        battery.removeEventListener('dischargingtimechange', handleChange);
      }
    };
  }, []);

  return batteryInfo;
};

// Export all hooks
export default {
  useAuth,
  useGoals,
  useChat,
  useWebSocket,
  useLocalStorage,
  useDebounce,
  usePrevious,
  useWindowSize,
  useMediaQuery,
  useOnlineStatus,
  useDocumentTitle,
  useClickOutside,
  useIntersectionObserver,
  useClipboard,
  useAsync,
  useFormValidation,
  useDarkMode,
  useKeyboardShortcut,
  usePolling,
  useTimer,
  useBattery,
};