import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { RestaurantIconSvg, CustomerIconSvg, DeliveryIconSvg } from '../icons';

// Fix for default marker icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Memoize icon creation for performance
const createDivIcon = (icon: React.ReactElement) => {
  return new L.DivIcon({
    html: renderToStaticMarkup(icon),
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  });
};

const restaurantIcon = createDivIcon(<RestaurantIconSvg className="w-full h-full text-red-600" />);
const customerIcon = createDivIcon(<CustomerIconSvg className="w-full h-full text-green-600" />);
const deliveryIcon = createDivIcon(<DeliveryIconSvg className="w-full h-full text-blue-600 animate-pulse" />);

interface MapProps {
  restaurantLoc: { lat: number; lon: number };
  customerLoc: { lat: number; lon: number };
  deliveryLoc?: { lat: number; lon: number } | null;
  routePath?: Array<[number, number]> | null;
  distance?: number | null;
  duration?: number | null;
}

const MapComponent: React.FC<MapProps> = ({ restaurantLoc, customerLoc, deliveryLoc, routePath, distance, duration }) => {
    // Memoize bounds calculation for performance
    const bounds = useMemo(() => {
        const allPoints: L.LatLngExpression[] = [
            [restaurantLoc.lat, restaurantLoc.lon],
            [customerLoc.lat, customerLoc.lon],
        ];
        if (deliveryLoc) {
            allPoints.push([deliveryLoc.lat, deliveryLoc.lon]);
        }
        return L.latLngBounds(allPoints);
    }, [restaurantLoc, customerLoc, deliveryLoc]);

    return (
        <MapContainer
            bounds={bounds}
            boundsOptions={{ padding: [20, 20] }}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
            preferCanvas={true}
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={18}
                tileSize={256}
                updateWhenIdle={true}
                keepBuffer={2}
            />
            
            {/* Draw the route path */}
            {routePath && routePath.length > 0 && (
                <Polyline 
                    positions={routePath} 
                    color="#FF6B35" 
                    weight={4}
                    opacity={0.8}
                    smoothFactor={1}
                />
            )}
            
            <Marker position={[restaurantLoc.lat, restaurantLoc.lon]} icon={restaurantIcon}>
                <Popup>
                    <div className="text-center">
                        <strong>🍽️ Varaha Swami</strong>
                        {distance && duration && (
                            <p className="text-sm mt-1">
                                📍 {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}<br/>
                                ⏱️ ~{duration} min
                            </p>
                        )}
                    </div>
                </Popup>
            </Marker>
            
            <Marker position={[customerLoc.lat, customerLoc.lon]} icon={customerIcon}>
                <Popup>📍 Your Location</Popup>
            </Marker>
            
            {deliveryLoc && (
                <>
                    <Marker position={[deliveryLoc.lat, deliveryLoc.lon]} icon={deliveryIcon}>
                        <Popup>🛵 Delivery Partner</Popup>
                    </Marker>
                    <Polyline 
                        positions={[[deliveryLoc.lat, deliveryLoc.lon], [customerLoc.lat, customerLoc.lon]]} 
                        color="blue" 
                        weight={3}
                        dashArray="5, 10" 
                    />
                </>
            )}
        </MapContainer>
    );
};


export default MapComponent;
