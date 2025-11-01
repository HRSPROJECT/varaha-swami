import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Order, OrderStatus } from '../../types';
import { formatCurrency } from '../../lib/utils';
import Loading from '../shared/Loading';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const DeliveryView: React.FC = () => {
    const { user, profile, signOut } = useAuth();
    const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
    const [myOrders, setMyOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(false);
    const watchId = useRef<number | null>(null);

    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // Get available orders (ready for pickup) AND orders assigned to this delivery person
        const availablePromise = supabase
            .from('orders')
            .select('*, profiles!orders_customer_id_fkey(*)')
            .or(`status.eq.ready,and(delivery_boy_id.eq.${user.id},status.eq.ready)`)
            .eq('order_type', 'delivery'); // Only delivery orders
            
        const myOrdersPromise = supabase
            .from('orders')
            .select('*, profiles!orders_customer_id_fkey(*)')
            .eq('delivery_boy_id', user.id)
            .in('status', [OrderStatus.PickedUp, OrderStatus.Delivered])
            .order('created_at', {ascending: false});

        const [availableRes, myOrdersRes] = await Promise.all([availablePromise, myOrdersPromise]);
        
        if (availableRes.error) toast.error('Could not fetch available orders.');
        else setAvailableOrders(availableRes.data as Order[] || []);

        if (myOrdersRes.error) toast.error('Could not fetch your orders.');
        else setMyOrders(myOrdersRes.data as Order[] || []);

        setLoading(false);
    }, [user]);

    useEffect(() => {
        // Load saved online status
        if (profile?.is_online) {
            setIsOnline(true);
            // Auto-start location tracking if was online
            navigator.geolocation.getCurrentPosition(
                (position) => updateLocation(position.coords.latitude, position.coords.longitude),
                (error) => console.warn('Location restore failed:', error),
                { enableHighAccuracy: true }
            );
        }

        fetchOrders();
        const orderSubscription = supabase
            .channel('orders-delivery')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders' 
            }, (payload) => {
                console.log('📡 Delivery order change:', payload);
                fetchOrders();
            })
            .subscribe();

        // Polling fallback every 10 seconds
        const polling = setInterval(() => {
            fetchOrders();
        }, 10000);

        return () => {
            supabase.removeChannel(orderSubscription);
            clearInterval(polling);
            if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
        };
    }, [fetchOrders, profile]);

    const updateLocation = async (lat: number, lon: number) => {
        if (!user) return;
        const { error } = await supabase.from('profiles').update({ lat, lon }).eq('id', user.id);
        if(error) console.error("Failed to update location", error.message);
    };

    const updateOnlineStatus = async (status: boolean) => {
        if (!user) return;
        const { error } = await supabase
            .from('profiles')
            .update({ is_online: status })
            .eq('id', user.id);
        if (error) console.error("Failed to update online status", error);
    };

    const toggleOnlineStatus = () => {
        setIsOnline(prev => {
            const newStatus = !prev;
            updateOnlineStatus(newStatus);
            
            if (newStatus) {
                navigator.geolocation.getCurrentPosition(
                    (position) => updateLocation(position.coords.latitude, position.coords.longitude),
                    (error) => toast.error(`Location error: ${error.message}`),
                    { enableHighAccuracy: true }
                );
                watchId.current = navigator.geolocation.watchPosition(
                    (position) => updateLocation(position.coords.latitude, position.coords.longitude),
                    (error) => {
                        console.warn(`GPS tracking error: ${error.message}`);
                        // Don't auto-offline on GPS errors, keep status as is
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
                );
                toast.success("You are ONLINE. Sharing your location.");
            } else {
                if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
                toast("You are OFFLINE.");
            }
            return newStatus;
        });
    };
    
    const handleOrderAction = async (orderId: number, currentStatus: OrderStatus) => {
        if (!user) return;

        let newStatus: OrderStatus;
        let updateData: any;
        let toastMessage = '';

        if (currentStatus === OrderStatus.Ready) {
            newStatus = OrderStatus.PickedUp;
            updateData = { status: newStatus, delivery_boy_id: user.id };
            toastMessage = `Order #${orderId} accepted.`;
        } else if (currentStatus === OrderStatus.PickedUp) {
            newStatus = OrderStatus.Delivered;
            updateData = { status: newStatus };
            toastMessage = `Order #${orderId} marked as delivered.`;
        } else {
            return;
        }

        const toastId = toast.loading('Updating order...');
        const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
        
        if (error) {
            toast.error(`Failed to update order #${orderId}.`, {id: toastId});
        } else {
            toast.success(toastMessage, {id: toastId});
            // Immediately update local state
            setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
            if (newStatus === OrderStatus.PickedUp) {
                // Move to my orders
                const updatedOrder = availableOrders.find(o => o.id === orderId);
                if (updatedOrder) {
                    setMyOrders(prev => [{ ...updatedOrder, status: newStatus, delivery_boy_id: user.id }, ...prev]);
                }
            }
        }
    };
    
    if (loading) return <Loading text="Loading Delivery Dashboard..." />;

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow p-4 sticky top-0 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-orange-600">Delivery Dashboard</h1>
                        <p className="text-sm text-gray-500">Welcome, {profile?.full_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={toggleOnlineStatus} className={`px-4 py-2 rounded-full font-bold text-white flex items-center gap-2 transition ${isOnline ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                           <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-300'}`}></span>
                            {isOnline ? 'Go Offline' : 'Go Online'}
                        </button>
                        <button onClick={signOut} className="text-gray-500 hover:text-orange-600 font-semibold">Logout</button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-orange-500">Available for Pickup</h2>
                    <div className="space-y-4">
                        {availableOrders.length > 0 ? availableOrders.map(order => (
                            <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
                                <p className="font-bold text-lg">Order #{order.id}</p>
                                <p className="text-sm text-gray-600">To: {order.profiles.full_name}</p>
                                {order.house_no && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        📍 {order.house_no}
                                        {order.building_no && `, ${order.building_no}`}
                                        {order.landmark && `, Near ${order.landmark}`}
                                        <br />📞 {order.customer_phone}
                                    </div>
                                )}
                                <p className="font-semibold mt-1">{formatCurrency(order.total_price)}</p>
                                <button onClick={() => handleOrderAction(order.id, OrderStatus.Ready)} className="mt-3 w-full bg-blue-500 text-white p-2 rounded-lg font-bold hover:bg-blue-600 transition">Accept Delivery</button>
                            </motion.div>
                        )) : <p className="text-gray-500 mt-4">No orders currently ready for pickup.</p>}
                    </div>
                </div>
                 <div>
                    <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-orange-500">My Deliveries</h2>
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-700">In Progress</h3>
                        {myOrders.filter(o => o.status === OrderStatus.PickedUp).length > 0 ? 
                            myOrders.filter(o => o.status === OrderStatus.PickedUp).map(order => (
                            <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-4 rounded-lg shadow-lg border-l-4 border-yellow-400">
                                <p className="font-bold text-lg">Order #{order.id}</p>
                                <p className="text-sm text-gray-600">To: {order.profiles.full_name}</p>
                                {order.house_no && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        📍 {order.house_no}
                                        {order.building_no && `, ${order.building_no}`}
                                        {order.landmark && `, Near ${order.landmark}`}
                                        <br />📞 {order.customer_phone}
                                    </div>
                                )}
                                <p className="font-semibold mt-1">{formatCurrency(order.total_price)}</p>
                                <button onClick={() => handleOrderAction(order.id, OrderStatus.PickedUp)} className="mt-3 w-full bg-green-500 text-white p-2 rounded-lg font-bold hover:bg-green-600 transition">Mark as Delivered</button>
                            </motion.div>
                        )) : <p className="text-gray-500">No active deliveries.</p>}
                        
                        <h3 className="font-semibold text-gray-700 mt-6 pt-4 border-t">Completed</h3>
                         {myOrders.filter(o => o.status === OrderStatus.Delivered).length > 0 ? 
                            myOrders.filter(o => o.status === OrderStatus.Delivered).map(order => (
                            <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-4 rounded-lg shadow-sm opacity-70 border-l-4 border-green-500">
                                <p className="font-bold">Order #{order.id}</p>
                                <p>Status: Delivered</p>
                            </motion.div>
                         )) : <p className="text-gray-500">No completed deliveries yet.</p>}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DeliveryView;
