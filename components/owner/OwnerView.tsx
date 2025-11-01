import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Order, OrderStatus, MenuItem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import Loading from '../shared/Loading';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const OwnerView: React.FC = () => {
    const { profile, signOut } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
    const [showMenuForm, setShowMenuForm] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [isRestaurantOnline, setIsRestaurantOnline] = useState(true);

    // Menu form state
    const [menuForm, setMenuForm] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
        is_available: true,
        preparation_time_minutes: '15'
    });

    const fetchOrders = useCallback(async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`*, order_items(*, menu_items(*)), profiles!orders_customer_id_fkey(*)`)
            .order('created_at', { ascending: false });

        if (error) {
            toast.error("Could not fetch orders.");
        } else {
            setOrders(data as Order[]);
        }
    }, []);

    const fetchMenuItems = useCallback(async () => {
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('is_deleted', false) // Exclude soft-deleted items
            .order('category', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            toast.error("Could not fetch menu items.");
        } else {
            setMenuItems(data as MenuItem[]);
        }
    }, []);

    const updateRestaurantStatus = async (status: boolean) => {
        if (!profile?.id) return;
        const { error } = await supabase
            .from('profiles')
            .update({ is_online: status })
            .eq('id', profile.id);
        if (error) console.error("Failed to update restaurant status", error);
    };

    const toggleRestaurantStatus = () => {
        const newStatus = !isRestaurantOnline;
        setIsRestaurantOnline(newStatus);
        updateRestaurantStatus(newStatus);
        toast.success(`Restaurant is now ${newStatus ? 'ONLINE' : 'OFFLINE'}`);
    };

    useEffect(() => {
        // Load saved restaurant online status
        if (profile?.is_online !== undefined) {
            setIsRestaurantOnline(profile.is_online);
        }

        const fetchData = async () => {
            setLoading(true);
            await Promise.all([fetchOrders(), fetchMenuItems()]);
            setLoading(false);
        };
        
        fetchData();

        const orderSubscription = supabase
            .channel('orders-owner')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders' 
            }, (payload) => {
                console.log('📡 Owner order change:', payload);
                fetchOrders();
            })
            .subscribe();

        const menuSubscription = supabase
            .channel('menu-items-owner')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'menu_items' 
            }, (payload) => {
                console.log('📋 Owner menu change:', payload);
                fetchMenuItems();
            })
            .subscribe();

        // Polling fallback every 15 seconds
        const polling = setInterval(() => {
            fetchOrders();
        }, 15000);

        return () => {
            supabase.removeChannel(orderSubscription);
            supabase.removeChannel(menuSubscription);
            clearInterval(polling);
        };
    }, [fetchOrders, fetchMenuItems, profile]);

    const updateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
        const toastId = toast.loading('Updating order status...');
        
        // Find the order to check if it's delivery type
        const order = orders.find(o => o.id === orderId);
        
        let updateData: any = { status: newStatus };
        
        // If marking as Ready and it's a delivery order, auto-assign to available delivery person
        if (newStatus === OrderStatus.Ready && order?.order_type === 'delivery') {
            try {
                // Find an available delivery person (online or offline)
                const { data: deliveryPersons, error: deliveryError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('user_type', 'delivery')
                    .limit(1);
                
                if (!deliveryError && deliveryPersons && deliveryPersons.length > 0) {
                    updateData.delivery_boy_id = deliveryPersons[0].id;
                    console.log(`Auto-assigned delivery person ${deliveryPersons[0].id} to order ${orderId}`);
                }
            } catch (error) {
                console.warn('Could not auto-assign delivery person:', error);
            }
        }
        
        const { error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (error) {
            toast.error(`Failed to update order #${orderId}.`, { id: toastId });
        } else {
            toast.success(`Order #${orderId} marked as ${newStatus}.`, { id: toastId });
            // Immediately update local state for instant UI feedback
            setOrders(prevOrders => 
                prevOrders.map(o => 
                    o.id === orderId 
                        ? { ...o, status: newStatus, ...updateData }
                        : o
                )
            );
        }
    };

    const handleMenuFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Debug logging
        console.log('🔍 Current user profile:', profile);
        console.log('🔍 User type:', profile?.user_type);
        
        // Validation
        if (!menuForm.name.trim()) {
            toast.error('Item name is required');
            return;
        }
        if (!menuForm.price || parseFloat(menuForm.price) <= 0) {
            toast.error('Valid price is required');
            return;
        }
        if (!menuForm.category.trim()) {
            toast.error('Category is required');
            return;
        }
        
        const toastId = toast.loading(editingItem ? 'Updating item...' : 'Adding item...');

        const itemData = {
            name: menuForm.name.trim(),
            description: menuForm.description.trim() || null,
            price: parseFloat(menuForm.price),
            category: menuForm.category.trim(),
            image_url: menuForm.image_url.trim() || null,
            is_available: menuForm.is_available,
            preparation_time_minutes: parseInt(menuForm.preparation_time_minutes) || 15
        };

        console.log('🔍 Attempting to save menu item:', itemData);

        try {
            if (editingItem) {
                console.log('🔍 Updating item ID:', editingItem.id);
                const { error, data } = await supabase
                    .from('menu_items')
                    .update(itemData)
                    .eq('id', editingItem.id)
                    .select();

                console.log('🔍 Update result:', { error, data });
                if (error) throw error;
                toast.success('Menu item updated successfully!', { id: toastId });
            } else {
                console.log('🔍 Inserting new item');
                const { error, data } = await supabase
                    .from('menu_items')
                    .insert(itemData)
                    .select();

                console.log('🔍 Insert result:', { error, data });
                if (error) throw error;
                toast.success('Menu item added successfully!', { id: toastId });
            }

            setShowMenuForm(false);
            setEditingItem(null);
            resetMenuForm();
            fetchMenuItems(); // Refresh menu items
        } catch (error: any) {
            console.error('❌ Menu form error:', error);
            console.error('❌ Error details:', error.details, error.hint, error.code);
            toast.error(`Failed: ${error.message}`, { id: toastId });
        }
    };

    const handleEditItem = (item: MenuItem) => {
        setEditingItem(item);
        setMenuForm({
            name: item.name,
            description: item.description || '',
            price: item.price.toString(),
            category: item.category || '',
            image_url: item.image_url || '',
            is_available: item.is_available,
            preparation_time_minutes: item.preparation_time_minutes?.toString() || '15'
        });
        setShowMenuForm(true);
    };

    const handleDeleteItem = async (itemId: number) => {
        console.log('🔍 Attempting to delete item ID:', itemId);
        console.log('🔍 Current user profile:', profile);

        // Check if item is used in any orders first
        const { data: orderItems, error: checkError } = await supabase
            .from('order_items')
            .select('id')
            .eq('menu_item_id', itemId)
            .limit(1);

        if (checkError) {
            toast.error('Error checking item usage');
            return;
        }

        if (orderItems && orderItems.length > 0) {
            toast.error('Cannot delete item - it has been ordered before. You can mark it as unavailable instead.');
            return;
        }

        if (!confirm('Are you sure you want to delete this menu item?')) return;

        const toastId = toast.loading('Deleting item...');
        
        try {
            const { error, data } = await supabase
                .from('menu_items')
                .delete()
                .eq('id', itemId)
                .select();

            console.log('🔍 Delete result:', { error, data });

            if (error) throw error;
            toast.success('Menu item deleted successfully!', { id: toastId });
            fetchMenuItems(); // Refresh menu items
        } catch (error: any) {
            console.error('❌ Delete error:', error);
            console.error('❌ Error details:', error.details, error.hint, error.code);
            toast.error(`Cannot delete: Item has been ordered before`, { id: toastId });
        }
    };

    const toggleAvailability = async (itemId: number, currentStatus: boolean) => {
        console.log('🔍 Toggling availability for item:', itemId, 'from', currentStatus, 'to', !currentStatus);
        
        // Optimistic update - update UI immediately
        setMenuItems(prev => 
            prev.map(item => 
                item.id === itemId 
                    ? { ...item, is_available: !currentStatus }
                    : item
            )
        );
        
        try {
            const { error, data } = await supabase
                .from('menu_items')
                .update({ is_available: !currentStatus })
                .eq('id', itemId)
                .select();

            console.log('🔍 Toggle result:', { error, data });

            if (error) throw error;
            toast.success(`Item marked as ${!currentStatus ? 'available' : 'unavailable'}.`);
        } catch (error: any) {
            console.error('❌ Toggle error:', error);
            // Revert optimistic update on error
            setMenuItems(prev => 
                prev.map(item => 
                    item.id === itemId 
                        ? { ...item, is_available: currentStatus }
                        : item
                )
            );
            toast.error(`Failed to update availability: ${error.message}`);
        }
    };

    const resetMenuForm = () => {
        setMenuForm({
            name: '',
            description: '',
            price: '',
            category: '',
            image_url: '',
            is_available: true,
            preparation_time_minutes: '15'
        });
    };

    const handleCancelForm = () => {
        setShowMenuForm(false);
        setEditingItem(null);
        resetMenuForm();
    };
    
    const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
        const getAction = () => {
            switch(order.status) {
                case OrderStatus.Pending:
                    return { text: 'Confirm Order', action: () => updateOrderStatus(order.id, OrderStatus.Confirmed), className: 'bg-blue-500 hover:bg-blue-600' };
                case OrderStatus.Confirmed:
                    return { text: 'Start Preparing', action: () => updateOrderStatus(order.id, OrderStatus.Preparing), className: 'bg-yellow-500 hover:bg-yellow-600' };
                case OrderStatus.Preparing:
                    return { text: 'Ready for Pickup', action: () => updateOrderStatus(order.id, OrderStatus.Ready), className: 'bg-green-500 hover:bg-green-600' };
                case OrderStatus.Ready:
                    return { text: 'Mark as Picked Up', action: () => updateOrderStatus(order.id, OrderStatus.PickedUp), className: 'bg-purple-500 hover:bg-purple-600' };
                default:
                    return null;
            }
        };

        const action = getAction();

        return (
            <motion.div layout className="bg-white p-4 rounded-lg shadow-md space-y-3 border-l-4 border-orange-500">
                <div className="flex justify-between items-start">
                    <div>
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
                        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</p>
                        {order.order_type && (
                            <p className="text-xs text-blue-600 font-semibold mt-1">
                                {order.order_type === 'delivery' ? '🚚 Delivery' : '🏃 Pickup'}
                                {order.estimated_prep_time && (
                                    <span className="ml-2 text-orange-600">
                                        ⏱️ {order.estimated_prep_time}min prep
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                    <span className="text-sm font-semibold capitalize px-2 py-1 bg-gray-100 text-gray-800 rounded-full">{order.status.replace('_', ' ')}</span>
                </div>
                <div className="text-sm border-t border-b py-2 space-y-1">
                    {order.order_items.map(item => (
                        <div key={item.id} className="flex justify-between">
                            <span>{item.quantity} x {item.menu_items.name}</span>
                            <span>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between items-center">
                    <p className="font-bold text-lg">Total: {formatCurrency(order.total_price)}</p>
                    {action && (
                        <button onClick={action.action} className={`text-white px-4 py-2 rounded-md font-semibold text-sm transition ${action.className}`}>
                            {action.text}
                        </button>
                    )}
                </div>
            </motion.div>
        )
    };

    const orderColumns: { title: string; status: OrderStatus[]; color: string }[] = [
        { title: 'New Orders', status: [OrderStatus.Pending], color: 'border-blue-500' },
        { title: 'In Progress', status: [OrderStatus.Confirmed, OrderStatus.Preparing], color: 'border-yellow-500' },
        { title: 'Ready for Pickup', status: [OrderStatus.Ready], color: 'border-green-500' },
        { title: 'Out for Delivery', status: [OrderStatus.PickedUp], color: 'border-purple-500' },
        { title: 'Completed', status: [OrderStatus.Delivered, OrderStatus.Cancelled], color: 'border-gray-400' },
    ];

    const categories = Array.from(new Set(menuItems.map(item => item.category).filter(Boolean)));

    if (loading) return <Loading text="Loading Owner Dashboard..." />;

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow p-4 sticky top-0 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-orange-600">Restaurant Dashboard</h1>
                        <p className="text-sm text-gray-500">Welcome, <span className="font-semibold">{profile?.full_name}</span></p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleRestaurantStatus}
                            className={`px-4 py-2 rounded-full font-bold text-white flex items-center gap-2 transition ${
                                isRestaurantOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                            }`}
                        >
                            <span className={`w-3 h-3 rounded-full ${isRestaurantOnline ? 'bg-white animate-pulse' : 'bg-gray-300'}`}></span>
                            {isRestaurantOnline ? 'Restaurant Online' : 'Restaurant Offline'}
                        </button>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`px-4 py-2 rounded-lg font-semibold transition ${
                                activeTab === 'orders' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            📦 Orders
                        </button>
                        <button
                            onClick={() => setActiveTab('menu')}
                            className={`px-4 py-2 rounded-lg font-semibold transition ${
                                activeTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            🍽️ Menu
                        </button>
                        <button onClick={signOut} className="text-gray-500 hover:text-orange-600 font-semibold">Logout</button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4">
                <AnimatePresence mode="wait">
                    {activeTab === 'orders' ? (
                        <motion.div
                            key="orders"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
                        >
                            {orderColumns.map(col => (
                                <div key={col.title} className="bg-gray-50 p-3 rounded-lg flex flex-col">
                                    <h2 className={`font-bold text-lg mb-4 p-2 rounded-t-lg text-gray-800 border-b-4 ${col.color}`}>{col.title}</h2>
                                    <div className="space-y-4 flex-grow">
                                        {orders.filter(o => col.status.includes(o.status)).map(order => (
                                            <OrderCard key={order.id} order={order} />
                                        ))}
                                        {orders.filter(o => col.status.includes(o.status)).length === 0 && <p className="text-sm text-gray-500 text-center mt-4">No orders in this column.</p>}
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="menu"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="mb-6 flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-gray-800">Menu Management</h2>
                                <button
                                    onClick={() => setShowMenuForm(true)}
                                    className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-700 transition flex items-center gap-2"
                                >
                                    <span className="text-xl">+</span> Add New Item
                                </button>
                            </div>

                            {/* Menu Form Modal */}
                            <AnimatePresence>
                                {showMenuForm && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                                        onClick={handleCancelForm}
                                    >
                                        <motion.div
                                            initial={{ scale: 0.9, y: 20 }}
                                            animate={{ scale: 1, y: 0 }}
                                            exit={{ scale: 0.9, y: 20 }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                                        >
                                            <h3 className="text-2xl font-bold mb-6 text-gray-800">
                                                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                                            </h3>
                                            <form onSubmit={handleMenuFormSubmit} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Item Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={menuForm.name}
                                                        onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                        placeholder="e.g., Margherita Pizza"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                                    <textarea
                                                        value={menuForm.description}
                                                        onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                        placeholder="Describe your dish..."
                                                        rows={3}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Price (₹) *</label>
                                                        <input
                                                            type="number"
                                                            required
                                                            step="0.01"
                                                            min="0"
                                                            value={menuForm.price}
                                                            onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                            placeholder="99.00"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            list="categories"
                                                            value={menuForm.category}
                                                            onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                            placeholder="e.g., Pizza, Burgers, Salads"
                                                        />
                                                        <datalist id="categories">
                                                            {categories.map(cat => <option key={cat} value={cat} />)}
                                                        </datalist>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL</label>
                                                    <input
                                                        type="url"
                                                        value={menuForm.image_url}
                                                        onChange={(e) => setMenuForm({ ...menuForm, image_url: e.target.value })}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                        placeholder="https://example.com/image.jpg"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Optional: Add an image URL for your dish</p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Preparation Time (minutes)</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={menuForm.preparation_time_minutes}
                                                        onChange={(e) => setMenuForm({ ...menuForm, preparation_time_minutes: e.target.value })}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                        placeholder="15"
                                                    />
                                                </div>

                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id="is_available"
                                                        checked={menuForm.is_available}
                                                        onChange={(e) => setMenuForm({ ...menuForm, is_available: e.target.checked })}
                                                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                                    />
                                                    <label htmlFor="is_available" className="ml-2 text-sm font-medium text-gray-700">
                                                        Available for order
                                                    </label>
                                                </div>

                                                <div className="flex gap-3 pt-4">
                                                    <button
                                                        type="submit"
                                                        className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition"
                                                    >
                                                        {editingItem ? 'Update Item' : 'Add Item'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleCancelForm}
                                                        className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-400 transition"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Menu Items Grid */}
                            <div className="space-y-6">
                                {categories.length === 0 && menuItems.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-gray-500 text-lg">No menu items yet. Add your first item!</p>
                                    </div>
                                ) : (
                                    categories.map(category => (
                                        <div key={category}>
                                            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-orange-500">{category}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {menuItems.filter(item => item.category === category).map(item => (
                                                    <motion.div
                                                        key={item.id}
                                                        layout
                                                        className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
                                                    >
                                                        <div className="relative">
                                                            <img
                                                                src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}
                                                                alt={item.name}
                                                                className="w-full h-40 object-cover"
                                                            />
                                                            <div className="absolute top-2 right-2">
                                                                <button
                                                                    onClick={() => toggleAvailability(item.id, item.is_available)}
                                                                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                                        item.is_available
                                                                            ? 'bg-green-500 text-white'
                                                                            : 'bg-red-500 text-white'
                                                                    }`}
                                                                >
                                                                    {item.is_available ? '✓ Available' : '✕ Unavailable'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="p-4">
                                                            <h4 className="font-bold text-lg mb-1">{item.name}</h4>
                                                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                                                            <div className="flex justify-between items-center mb-3">
                                                                <span className="text-lg font-bold text-orange-600">{formatCurrency(item.price)}</span>
                                                                <span className="text-xs text-gray-500">⏱️ {item.preparation_time_minutes}min</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleEditItem(item)}
                                                                    className="flex-1 bg-blue-500 text-white py-2 rounded-md text-sm font-semibold hover:bg-blue-600 transition"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteItem(item.id)}
                                                                    className="flex-1 bg-red-500 text-white py-2 rounded-md text-sm font-semibold hover:bg-red-600 transition"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default OwnerView;
