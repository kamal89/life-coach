import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Target, TrendingUp, Calendar, Plus, Check, X, Edit3, BarChart3, Brain, Zap, User, Settings, LogOut } from 'lucide-react';

const LifeCoachApp = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'

  // Core state management
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  // Goal tracking state
  const [goals, setGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    category: 'personal',
    type: 'short-term',
    targetDate: '',
    description: ''
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const messagesEndRef = useRef(null);
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load user data on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUserData(token);
    }
  }, []);

  // Load goals when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadGoals();
      loadChatHistory();
    }
  }, [isAuthenticated]);

  // API helper function
  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Authentication functions
  const handleAuth = async (formData, isLogin = true) => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const data = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      localStorage.setItem('token', data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      
      // Welcome message for new users
      if (!isLogin) {
        setMessages([{
          id: 1,
          type: 'ai',
          content: `Welcome to AI Life Coach, ${data.user.name}! I'm here to help you set, track, and achieve your goals. Let's start by creating your first goal or telling me what you'd like to work on.`,
          timestamp: new Date()
        }]);
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async (token) => {
    try {
      const data = await apiCall('/users/profile');
      setUser(data.user);
      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    setMessages([]);
    setGoals([]);
    setActiveTab('chat');
  };

  // Goal management functions
  const loadGoals = async () => {
    try {
      const data = await apiCall('/goals');
      setGoals(data.goals);
    } catch (error) {
      console.error('Failed to load goals:', error);
    }
  };

  const createGoal = async () => {
    if (!newGoal.title.trim()) return;
    
    setIsLoading(true);
    try {
      const data = await apiCall('/goals', {
        method: 'POST',
        body: JSON.stringify(newGoal)
      });
      
      setGoals(prev => [...prev, data.goal]);
      setNewGoal({
        title: '',
        category: 'personal',
        type: 'short-term',
        targetDate: '',
        description: ''
      });
      setShowGoalForm(false);
      
      // Add confirmation message
      const confirmationMessage = {
        id: Date.now(),
        type: 'ai',
        content: `Great! I've added "${data.goal.title}" to your goals. This ${data.goal.type} ${data.goal.category} goal will help drive your progress. Let's break this down into actionable steps. What's the first milestone you need to hit?`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, confirmationMessage]);
    } catch (error) {
      setError('Failed to create goal');
    } finally {
      setIsLoading(false);
    }
  };

  const updateGoalProgress = async (goalId, newProgress) => {
    try {
      const data = await apiCall(`/goals/${goalId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ 
          progress: Math.min(100, Math.max(0, newProgress)),
          note: `Progress updated to ${newProgress}%`
        })
      });
      
      setGoals(prev => prev.map(goal => 
        goal._id === goalId ? data.goal : goal
      ));
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  // Chat functions
  const loadChatHistory = async () => {
    try {
      const data = await apiCall('/chat/history?limit=20');
      setMessages(data.messages.map(msg => ({
        id: msg._id,
        type: msg.type,
        content: msg.content,
        timestamp: new Date(msg.createdAt)
      })));
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsTyping(true);
    
    try {
      const data = await apiCall('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ message: currentInput })
      });
      
      const aiMessage = {
        id: data.aiMessage._id,
        type: 'ai',
        content: data.aiMessage.content,
        timestamp: new Date(data.aiMessage.createdAt)
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: "I apologize, but I'm having trouble responding right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action handlers
  const handleQuickAction = (action) => {
    const actions = {
      progress: "How am I doing with my progress this week?",
      motivation: "I'm feeling stuck and need motivation",
      newGoal: "Help me set a new goal"
    };
    
    setInputMessage(actions[action]);
    setTimeout(() => sendMessage(), 100);
  };

  // Utility functions
  const getCategoryIcon = (category) => {
    const icons = {
      fitness: '💪',
      career: '💼',
      personal: '🎯',
      learning: '📚',
      relationships: '❤️',
      finance: '💰',
      health: '🏥'
    };
    return icons[category] || '⭐';
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-600 bg-green-50',
      paused: 'text-yellow-600 bg-yellow-50',
      completed: 'text-blue-600 bg-blue-50'
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  };

  // Login/Register Form Component
  const AuthForm = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg inline-block mb-4">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Life Coach</h1>
          <p className="text-gray-600">Your personal guide to achieving goals</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);
          handleAuth(data, authView === 'login');
        }}>
          {authView === 'register' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Please wait...' : (authView === 'login' ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setAuthView(authView === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            {authView === 'login' 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"
            }
          </button>
        </div>
      </div>
    </div>
  );

  // Main App Component
  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return (
    <div className="max-w-7xl mx-auto h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Life Coach</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Tab Navigation */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors ${
                    activeTab === 'chat' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => setActiveTab('goals')}
                  className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors ${
                    activeTab === 'goals' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Target className="h-4 w-4" />
                  <span>Goals</span>
                </button>
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <User className="h-5 w-5 text-gray-600" />
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        // Add profile settings handler
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {activeTab === 'chat' ? (
          // Chat Interface
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to your AI Life Coach!</h3>
                  <p className="text-gray-600 mb-6">Start a conversation or check your goal progress.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => handleQuickAction('progress')}
                      className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                    >
                      Check my progress
                    </button>
                    <button
                      onClick={() => handleQuickAction('newGoal')}
                      className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm"
                    >
                      Set a new goal
                    </button>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-2xl px-4 py-3 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white ml-4'
                      : 'bg-white text-gray-800 shadow-sm border mr-4'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                    <div className={`text-xs mt-2 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 shadow-sm border mr-4 px-4 py-3 rounded-2xl">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-gray-600">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t bg-white p-4">
              <div className="flex space-x-3">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask for advice, share an update, or discuss your goals..."
                  className="flex-1 resize-none border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="1"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Zap className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Goals Dashboard
          <div className="flex-1 p-6">
            {/* Goals Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your Goals</h2>
                <p className="text-gray-600">Track progress and stay accountable</p>
              </div>
              <button
                onClick={() => setShowGoalForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Goal</span>
              </button>
            </div>

            {/* Goals Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {goals.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No goals yet</h3>
                  <p className="text-gray-600 mb-6">Create your first goal to start tracking your progress.</p>
                  <button
                    onClick={() => setShowGoalForm(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
                  >
                    Create Your First Goal
                  </button>
                </div>
              ) : (
                goals.map((goal) => (
                  <div key={goal._id} className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getCategoryIcon(goal.category)}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(goal.status)}`}>
                              {goal.status}
                            </span>
                            <span className="text-xs text-gray-500">{goal.type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{goal.progress}%</div>
                        <div className="text-xs text-gray-500">complete</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Progress</span>
                        <span className="text-sm text-gray-500">
                          Target: {goal.targetDate ? new Date(goal.targetDate).toLocaleDateString() : 'No deadline'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${goal.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Progress Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateGoalProgress(goal._id, goal.progress - 5)}
                          className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                          disabled={goal.progress <= 0}
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => updateGoalProgress(goal._id, goal.progress + 5)}
                          className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                          disabled={goal.progress >= 100}
                        >
                          <Plus className="h-4 w-4 text-green-600" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {Math.round((Date.now() - new Date(goal.createdAt)) / (1000 * 60 * 60 * 24))} days active
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Goal Form Modal */}
            {showGoalForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold mb-4">Create New Goal</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title</label>
                      <input
                        type="text"
                        value={newGoal.title}
                        onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Read 12 books this year"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          value={newGoal.category}
                          onChange={(e) => setNewGoal({...newGoal, category: e.target.value})}
                          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="personal">Personal</option>
                          <option value="fitness">Fitness</option>
                          <option value="career">Career</option>
                          <option value="learning">Learning</option>
                          <option value="relationships">Relationships</option>
                          <option value="finance">Finance</option>
                          <option value="health">Health</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
                        <select
                          value={newGoal.type}
                          onChange={(e) => setNewGoal({...newGoal, type: e.target.value})}
                          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="short-term">Short-term</option>
                          <option value="long-term">Long-term</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                      <input
                        type="date"
                        value={newGoal.targetDate}
                        onChange={(e) => setNewGoal({...newGoal, targetDate: e.target.value})}
                        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                      <textarea
                        value={newGoal.description}
                        onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                        placeholder="Describe your goal in more detail..."
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setShowGoalForm(false)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createGoal}
                      disabled={!newGoal.title.trim() || isLoading}
                      className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Creating...' : 'Create Goal'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sidebar - Goals Summary */}
        {activeTab === 'chat' && (
          <div className="w-80 bg-white border-l p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Quick Progress
            </h3>
            
            <div className="space-y-4">
              {goals.slice(0, 3).map((goal) => (
                <div key={goal._id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{goal.title}</span>
                    <span className="text-xs text-blue-600 font-semibold">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                      style={{ width: `${goal.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {goals.length > 0 && (
              <button
                onClick={() => setActiveTab('goals')}
                className="w-full mt-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
              >
                View All Goals →
              </button>
            )}

            {/* Quick Actions */}
            <div className="mt-8">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button 
                  onClick={() => handleQuickAction('progress')}
                  className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  📊 Check my progress
                </button>
                <button 
                  onClick={() => handleQuickAction('motivation')}
                  className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  💪 I need motivation
                </button>
                <button 
                  onClick={() => handleQuickAction('newGoal')}
                  className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  🎯 Set a new goal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LifeCoachApp;