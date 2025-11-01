import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { MenuItem, Order, CartItem, OrderType, OrderStatus, Profile } from '../../types';
import { haversineDistance, formatCurrency, getRoute } from '../../lib/utils';
import Map from '../shared/Map';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';

const shopLocation = {
  lat: parseFloat(import.meta.env.VITE_SHOP_LAT || '18.46483341909941'),
  lon: parseFloat(import.meta.env.VITE_SHOP_LON || '73.81674169770542'),
};
const deliveryRadius = parseFloat(import.meta.env.VITE_DELIVERY_RADIUS_KM || '5');

const CustomerView: React.FC = () => {
    const { user, profile, signOut } = useAuth();
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loadingMenu, setLoadingMenu] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [customerLocation, setCustomerLocation] = useState<{lat: number, lon: number} | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]> | null>(null);
    const [isDeliveryAvailable, setIsDeliveryAvailable] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [showRouteMap, setShowRouteMap] = useState(false);
    
    const [view, setView] = useState<'menu' | 'cart' | 'orders'>('menu');
    const [addressForm, setAddressForm] = useState({
        houseNo: '',
        buildingNo: '',
        landmark: '',
        phone: ''
    });

    // Get location every time component mounts and periodically update
    useEffect(() => {
        const updateLocation = () => {
            console.log('🔍 Requesting HIGH ACCURACY location update...');
            console.log('🏪 Shop location:', shopLocation);
            
            if (!navigator.geolocation) {
                setLocationError('Geolocation is not supported by your browser');
                toast.error('Geolocation not supported');
                return;
            }

            // Try to get high-accuracy location multiple times if needed
            let attemptCount = 0;
            const maxAttempts = 3;

            const getAccurateLocation = () => {
                attemptCount++;
                console.log(`📍 Location attempt ${attemptCount}/${maxAttempts}...`);

                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude, accuracy } = position.coords;
                        const loc = { lat: latitude, lon: longitude };
                        
                        console.log('📍 GPS Data:');
                        console.log('   Your Location:', `${latitude}, ${longitude}`);
                        console.log('   Shop Location:', `${shopLocation.lat}, ${shopLocation.lon}`);
                        console.log('   GPS Accuracy:', accuracy, 'meters');
                        console.log('   Time:', new Date(position.timestamp).toLocaleTimeString());
                        
                        // If accuracy is poor (>50m) and we haven't reached max attempts, try again
                        if (accuracy > 50 && attemptCount < maxAttempts) {
                            console.warn(`⚠️ Poor accuracy (${accuracy}m), retrying...`);
                            toast(`🎯 Improving GPS accuracy... (${attemptCount}/${maxAttempts})`, {
                                icon: '🎯',
                                duration: 2000
                            });
                            setTimeout(getAccurateLocation, 1000);
                            return;
                        }

                        setCustomerLocation(loc);
                        setLocationError(null);
                        
                        // Show loading toast
                        const toastId = toast.loading('🗺️ Calculating route...');
                        
                        try {
                            // Get FULL route information (distance, duration, path)
                            const route = await getRoute(
                                shopLocation.lat, 
                                shopLocation.lon, 
                                loc.lat, 
                                loc.lon
                            );
                            
                            console.log('🛣️ ROUTE CALCULATED:');
                            console.log(`   Distance: ${route.distance} km`);
                            console.log(`   Duration: ${route.duration} min`);
                            console.log(`   Route points: ${route.geometry.length}`);
                            console.log(`   Success: ${route.success}`);
                            
                            // Update state with route info
                            setDistance(route.distance);
                            setDuration(route.duration);
                            setRouteGeometry(route.geometry);
                            setIsDeliveryAvailable(route.distance <= deliveryRadius);
                            
                            // Google Maps verification
                            const googleMapsUrl = `https://www.google.com/maps/dir/${shopLocation.lat},${shopLocation.lon}/${latitude},${longitude}`;
                            console.log('🔗 Verify on Google Maps:', googleMapsUrl);
                            
                            // Show success with distance and ETA
                            if (route.distance < 1) {
                                toast.success(`📍 ${(route.distance * 1000).toFixed(0)}m away • ${route.duration} min`, { 
                                    id: toastId, 
                                    duration: 4000 
                                });
                            } else {
                                toast.success(`📍 ${route.distance.toFixed(1)}km away • ${route.duration} min`, { 
                                    id: toastId, 
                                    duration: 4000 
                                });
                            }
                            
                            // Show accuracy warning if GPS is poor
                            if (accuracy > 50) {
                                console.warn(`⚠️ GPS accuracy: ±${accuracy}m`);
                                toast(`⚠️ GPS accuracy: ±${Math.round(accuracy)}m`, { 
                                    icon: '⚠️',
                                    duration: 3000 
                                });
                            }
                        } catch (error) {
                            console.error('❌ Route calculation error:', error);
                            const straightDist = haversineDistance(shopLocation.lat, shopLocation.lon, loc.lat, loc.lon);
                            setDistance(straightDist);
                            setDuration(Math.ceil(straightDist * 3));
                            setIsDeliveryAvailable(straightDist <= deliveryRadius);
                            toast.error(`Approx: ${straightDist.toFixed(1)}km`, { id: toastId, duration: 3000 });
                        }
                    },
                    (error) => {
                        console.error('❌ Location error:', error.message, error);
                        let errorMsg = 'Unable to get your location';
                        
                        switch (error.code) {
                            case error.PERMISSION_DENIED:
                                errorMsg = 'Location permission denied. Please enable location access.';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMsg = 'Location information unavailable.';
                                break;
                            case error.TIMEOUT:
                                errorMsg = 'Location request timed out. Retrying...';
                                if (attemptCount < maxAttempts) {
                                    setTimeout(getAccurateLocation, 1000);
                                    return;
                                }
                                break;
                        }
                        
                        setLocationError(errorMsg);
                        toast.error(errorMsg, { duration: 4000 });
                    },
                    { 
                        enableHighAccuracy: true, // Use GPS
                        timeout: 15000,
                        maximumAge: 0 // Always fresh
                    }
                );
            };

            getAccurateLocation();
        };

        // Get location immediately on mount
        updateLocation();
        
        // Update location every 30 seconds for real-time tracking
        const locationInterval = setInterval(updateLocation, 30000);

        return () => {
            clearInterval(locationInterval);
        };
    }, []);

    // Fetch menu immediately (priority)
    const fetchMenu = useCallback(async () => {
        setLoadingMenu(true);
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('is_available', true)
            .eq('is_deleted', false); // Exclude soft-deleted items
        
        if (error) {
            console.error('Menu fetch error:', error);
        } else {
            setMenu(data || []);
        }
        setLoadingMenu(false);
    }, []);

    // Fetch orders only when needed (lazy loading)
    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setLoadingOrders(true);
        const { data, error } = await supabase
            .from('orders')
            .select(`*, order_items(*, menu_items(*)), delivery_boy_profile:profiles!orders_delivery_boy_id_fkey(*)`)
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10); // Only fetch last 10 orders
        
        if (error) {
            console.error('Orders fetch error:', error);
        } else {
            setOrders(data as Order[] || []);
        }
        setLoadingOrders(false);
    }, [user]);

    // Fetch menu immediately on mount
    useEffect(() => {
        fetchMenu();
    }, [fetchMenu]);

    // Only fetch orders when switching to orders tab
    useEffect(() => {
        if (view === 'orders' && orders.length === 0) {
            fetchOrders();
        }
    }, [view, fetchOrders, orders.length]);

    // Setup real-time subscriptions
    useEffect(() => {
        if (!user) return;

        // Real-time order updates
        const orderSubscription = supabase
            .channel('orders-customer')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders', 
                filter: `customer_id=eq.${user.id}` 
            }, (payload) => {
                console.log('📡 Customer order change:', payload);
                fetchOrders();
            })
            .subscribe();

        // Real-time menu updates
        const menuSubscription = supabase
            .channel('menu-items-customer')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'menu_items'
            }, (payload) => {
                console.log('📋 Menu updated:', payload);
                fetchMenu();
            })
            .subscribe();

        // Polling fallback every 10 seconds for orders
        const orderPolling = setInterval(() => {
            if (view === 'orders') {
                fetchOrders();
            }
        }, 10000);

        return () => {
            supabase.removeChannel(orderSubscription);
            supabase.removeChannel(menuSubscription);
            clearInterval(orderPolling);
        };
    }, [user?.id, view, fetchOrders, fetchMenu]);

    const addToCart = (item: MenuItem) => {
        setCart(prevCart => {
            const existing = prevCart.find(ci => ci.id === item.id);
            if (existing) {
                return prevCart.map(ci => ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
            }
            return [...prevCart, { ...item, quantity: 1 }];
        });
        toast.success(`${item.name} added!`, { duration: 2000 });
    };

    const updateQuantity = (itemId: number, newQuantity: number) => {
        if (newQuantity < 1) {
            setCart(cart.filter(item => item.id !== itemId));
        } else {
            setCart(cart.map(item => item.id === itemId ? {...item, quantity: newQuantity} : item));
        }
    }
    
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const placeOrder = async (orderType: OrderType) => {
        if (!user || cart.length === 0 || !customerLocation) {
            toast.error("Cart is empty or location is unavailable.");
            return;
        }
        
        if (orderType === OrderType.Delivery) {
            if (!addressForm.houseNo.trim() || !addressForm.phone.trim()) {
                toast.error("Please enter house number and phone number for delivery.");
                return;
            }
        }

        const toastId = toast.loading('Placing your order...');
        
        // Calculate estimated prep time based on cart items
        const totalPrepTime = cart.reduce((max, item) => 
            Math.max(max, item.preparation_time_minutes || 15), 0);
        
        // Calculate delivery time based on distance (2 min per 100m)
        const deliveryTime = distance ? Math.ceil((distance * 1000) / 100 * 2) : 15;
        
        const { data: orderData, error: orderError } = await supabase
            .from('orders').insert({
                customer_id: user.id,
                total_price: total,
                customer_lat: customerLocation.lat,
                customer_lon: customerLocation.lon,
                house_no: orderType === OrderType.Delivery ? addressForm.houseNo : '',
                building_no: orderType === OrderType.Delivery ? addressForm.buildingNo || null : null,
                landmark: orderType === OrderType.Delivery ? addressForm.landmark || null : null,
                customer_phone: addressForm.phone,
                estimated_prep_time: totalPrepTime,
                estimated_delivery_time: orderType === OrderType.Delivery ? deliveryTime : null,
                order_type: orderType
            }).select().single();
            
        if (orderError || !orderData) {
            toast.error('Failed to create order.', {id: toastId});
            return;
        }
        
        const orderItems = cart.map(item => ({
            order_id: orderData.id, 
            menu_item_id: item.id, 
            quantity: item.quantity, 
            price: item.price
        }));
        
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        
        if (itemsError) {
            toast.error('Failed to add items to order.', {id: toastId});
            await supabase.from('orders').delete().eq('id', orderData.id);
        } else {
            toast.success('Order placed successfully!', {id: toastId});
            setCart([]);
            setAddressForm({ houseNo: '', buildingNo: '', landmark: '', phone: '' });
            setView('orders');
            fetchOrders();
        }
    };

    const getOrderStatusDisplay = (order: Order) => {
        const timeSinceOrder = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
        
        switch (order.status) {
            case OrderStatus.Pending:
                return {
                    status: "🕐 Waiting for restaurant to accept",
                    message: "Your order is being reviewed by the restaurant",
                    color: "text-yellow-600 bg-yellow-50"
                };
            case OrderStatus.Confirmed:
                const prepTime = order.estimated_prep_time || 20;
                const remainingPrepTime = Math.max(0, prepTime - timeSinceOrder);
                return {
                    status: "👨‍🍳 Restaurant is preparing your order",
                    message: `Estimated preparation time: ${remainingPrepTime > 0 ? `${remainingPrepTime} minutes remaining` : 'Almost ready!'}`,
                    color: "text-blue-600 bg-blue-50"
                };
            case OrderStatus.Preparing:
                const prepTimeRemaining = Math.max(0, (order.estimated_prep_time || 20) - timeSinceOrder);
                return {
                    status: "🔥 Your food is being prepared",
                    message: `Estimated time: ${prepTimeRemaining > 0 ? `${prepTimeRemaining} minutes` : 'Almost ready!'}`,
                    color: "text-orange-600 bg-orange-50"
                };
            case OrderStatus.Ready:
                if (order.order_type === OrderType.Pickup) {
                    return {
                        status: "✅ Ready for pickup",
                        message: "Your order is ready! Please come to collect it.",
                        color: "text-green-600 bg-green-50"
                    };
                } else {
                    return {
                        status: "🚚 Your order is out for delivery",
                        message: `Estimated delivery time: ${order.estimated_delivery_time || 15} minutes`,
                        color: "text-purple-600 bg-purple-50"
                    };
                }
            case OrderStatus.PickedUp:
                const deliveryTime = order.estimated_delivery_time || 15;
                const remainingDeliveryTime = Math.max(0, deliveryTime - timeSinceOrder);
                return {
                    status: "🛵 On the way to you",
                    message: `Estimated arrival: ${remainingDeliveryTime > 0 ? `${remainingDeliveryTime} minutes` : 'Arriving soon!'}`,
                    color: "text-indigo-600 bg-indigo-50"
                };
            case OrderStatus.Delivered:
                return {
                    status: "✅ Delivered",
                    message: "Your order has been delivered. Enjoy your meal!",
                    color: "text-green-600 bg-green-50"
                };
            case OrderStatus.Cancelled:
                return {
                    status: "❌ Cancelled",
                    message: "This order has been cancelled",
                    color: "text-red-600 bg-red-50"
                };
            default:
                return {
                    status: "📋 Order placed",
                    message: "Your order is being processed",
                    color: "text-gray-600 bg-gray-50"
                };
        }
    };

    // Route Map Modal - Shows route from shop to customer
    const RouteMapModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
        if (!customerLocation) return null;
        
        return (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex flex-col p-4">
                <div className="bg-white p-4 rounded-xl shadow-lg mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold">Route to Restaurant</h2>
                            {distance && duration && (
                                <p className="text-sm text-gray-600 mt-1">
                                    📍 {distance < 1 ? `${(distance * 1000).toFixed(0)} meters` : `${distance.toFixed(1)} km`} • 
                                    ⏱️ {duration} min drive
                                </p>
                            )}
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-2xl font-bold text-gray-600 hover:text-gray-800"
                        >
                            &times;
                        </button>
                    </div>
                </div>
                <div className="flex-grow rounded-xl overflow-hidden">
                    <Map 
                        restaurantLoc={shopLocation} 
                        customerLoc={customerLocation}
                        routePath={routeGeometry}
                        distance={distance}
                        duration={duration}
                    />
                </div>
            </div>
        );
    };

    if (showRouteMap) return <RouteMapModal onClose={() => setShowRouteMap(false)} />;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-md p-4 sticky top-0 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-orange-600">Varaha Swami</h1>
                        <p className="text-sm text-gray-500">Welcome, {profile?.full_name || user?.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {distance !== null && (
                        <button 
                            onClick={() => setShowRouteMap(true)}
                            className={`text-sm px-3 py-1.5 rounded-full font-semibold cursor-pointer hover:shadow-lg transition ${isDeliveryAvailable ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                        >
                          {isDeliveryAvailable ? `✓ Delivery` : `📦 Pickup Only`}
                          <span className="text-xs ml-1 font-normal">
                            ({distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
                            {duration ? ` • ${duration}min` : ''})
                          </span>
                        </button>
                      )}
                      <button onClick={signOut} className="text-gray-500 hover:text-orange-600 font-semibold">Logout</button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 pb-24">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }} 
                  transition={{ duration: 0.15 }}
                >
                {view === 'menu' ? (
                    loadingMenu ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="mt-4 text-gray-600">Loading menu...</p>
                            </div>
                        </div>
                    ) : menu.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-500">No menu items available at the moment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {menu.map(item => (
                                <motion.div 
                                    key={item.id} 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col hover:shadow-xl transition-shadow"
                                >
                                    <img 
                                        src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'} 
                                        alt={item.name} 
                                        className="w-full h-48 object-cover"
                                        loading="lazy"
                                    />
                                    <div className="p-4 flex flex-col flex-grow">
                                        <h3 className="text-xl font-bold">{item.name}</h3>
                                        <p className="text-gray-600 my-2 flex-grow text-sm">{item.description}</p>
                                        <div className="flex justify-between items-center mt-4">
                                            <p className="text-lg font-bold text-orange-600">{formatCurrency(item.price)}</p>
                                            <button 
                                                onClick={() => addToCart(item)} 
                                                className="bg-orange-500 text-white px-5 py-2 rounded-full font-semibold hover:bg-orange-600 transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )
                ) : view === 'cart' ? (
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-3xl font-bold mb-6">Your Cart</h2>
                        {cart.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg shadow">
                                <p className="text-gray-500">Your cart is empty</p>
                                <button 
                                    onClick={() => setView('menu')}
                                    className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
                                >
                                    Browse Menu
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm">
                                        <img 
                                            src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'} 
                                            alt={item.name} 
                                            className="w-16 h-16 object-cover rounded-md"
                                        />
                                        <div className="flex-grow mx-4">
                                            <p className="font-semibold">{item.name}</p>
                                            <p className="text-sm text-gray-600">{formatCurrency(item.price)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300">-</button>
                                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300">+</button>
                                        </div>
                                        <p className="font-bold w-24 text-right">{formatCurrency(item.price * item.quantity)}</p>
                                    </div>
                                ))}
                                <div className="mt-6 pt-4 border-t text-right text-xl font-bold">
                                    Total: {formatCurrency(total)}
                                </div>
                                
                                {/* Detailed Address Form */}
                                <div className="mt-4 space-y-3">
                                    <h3 className="font-medium text-gray-700">Delivery Details</h3>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">House No. *</label>
                                            <input
                                                type="text"
                                                value={addressForm.houseNo}
                                                onChange={(e) => setAddressForm(prev => ({...prev, houseNo: e.target.value}))}
                                                placeholder="123, A-Block"
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                required
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Building No.</label>
                                            <input
                                                type="text"
                                                value={addressForm.buildingNo}
                                                onChange={(e) => setAddressForm(prev => ({...prev, buildingNo: e.target.value}))}
                                                placeholder="Tower B (optional)"
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Landmark</label>
                                        <input
                                            type="text"
                                            value={addressForm.landmark}
                                            onChange={(e) => setAddressForm(prev => ({...prev, landmark: e.target.value}))}
                                            placeholder="Near Metro Station (optional)"
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Phone Number *</label>
                                        <input
                                            type="tel"
                                            value={addressForm.phone}
                                            onChange={(e) => setAddressForm(prev => ({...prev, phone: e.target.value}))}
                                            placeholder="+91 9876543210"
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                                    {isDeliveryAvailable ? 
                                      <button onClick={() => placeOrder(OrderType.Delivery)} className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold text-lg hover:bg-green-700 transition">Place Delivery Order</button>
                                      : <div className="flex-1 text-center p-3 rounded-lg bg-gray-200 text-gray-600">Delivery not available</div>
                                    }
                                    <button onClick={() => placeOrder(OrderType.Pickup)} className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition">Place Pickup Order</button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold mb-6">Your Orders</h2>
                        {loadingOrders ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    <p className="mt-4 text-gray-600">Loading orders...</p>
                                </div>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg shadow">
                                <p className="text-gray-500">No orders yet</p>
                                <button 
                                    onClick={() => setView('menu')}
                                    className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
                                >
                                    Order Now
                                </button>
                            </div>
                        ) : (
                            orders.map(order => {
                                const statusInfo = getOrderStatusDisplay(order);
                                return (
                                    <div key={order.id} className="mb-4 p-4 bg-white rounded-lg shadow-md">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="font-bold text-lg">Order #{order.id}</p>
                                            <span className="text-xs text-gray-500 capitalize">
                                                {order.order_type}
                                            </span>
                                        </div>
                                        
                                        {/* Order Address */}
                                        {order.house_no && (
                                            <div className="text-sm text-gray-600 mb-2">
                                                📍 {order.house_no}
                                                {order.building_no && `, ${order.building_no}`}
                                                {order.landmark && `, Near ${order.landmark}`}
                                                <br />📞 {order.customer_phone}
                                            </div>
                                        )}
                                        
                                        <p className="text-sm text-gray-500 mb-3">{new Date(order.created_at).toLocaleString()}</p>
                                        
                                        {/* Order Items */}
                                        <ul className="text-sm text-gray-700 mb-3">
                                            {order.order_items.map(oi => (
                                                <li key={oi.id}>{oi.quantity} x {oi.menu_items.name}</li>
                                            ))}
                                        </ul>
                                        
                                        {/* Status Display */}
                                        <div className={`p-3 rounded-lg mb-3 ${statusInfo.color}`}>
                                            <p className="font-semibold text-sm">{statusInfo.status}</p>
                                            <p className="text-xs mt-1">{statusInfo.message}</p>
                                        </div>
                                        
                                        <div className="flex justify-between items-center pt-2 border-t">
                                            <p className="font-semibold text-xl">{formatCurrency(order.total_price)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
                </motion.div>
              </AnimatePresence>
            </main>
            <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-lg z-10 border-t">
                <div className="container mx-auto flex justify-around">
                    <NavButton label="Menu" active={view === 'menu'} onClick={() => setView('menu')} />
                    <NavButton label="Cart" active={view === 'cart'} onClick={() => setView('cart')} badge={cartItemCount} />
                    <NavButton label="Orders" active={view === 'orders'} onClick={() => setView('orders')} />
                </div>
            </nav>
        </div>
    );
};

const NavButton: React.FC<{label: string, active: boolean, onClick: () => void, badge?: number}> = ({label, active, onClick, badge}) => (
    <button onClick={onClick} className={`py-3 px-4 text-center flex-1 relative font-semibold transition-colors ${active ? 'text-orange-600' : 'text-gray-600 hover:text-orange-500'}`}>
        {label}
        {active && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600" />}
        {badge && badge > 0 && <span className="absolute top-1 right-2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{badge}</span>}
    </button>
);

export default CustomerView;
