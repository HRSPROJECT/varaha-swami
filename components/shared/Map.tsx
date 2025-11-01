import React from 'react';
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
  routePath?: Array<[number, number]> | null; // Add route geometry from API
  distance?: number | null; // Distance in km
  duration?: number | null; // Duration in minutes
}

const Map: React.FC<MapProps> = ({ restaurantLoc, customerLoc, deliveryLoc, routePath, distance, duration }) => {
    const allPoints: L.LatLngExpression[] = [
        [restaurantLoc.lat, restaurantLoc.lon],
        [customerLoc.lat, customerLoc.lon],
    ];
    if (deliveryLoc) {
        allPoints.push([deliveryLoc.lat, deliveryLoc.lon]);
    }
    const bounds = L.latLngBounds(allPoints);

    return (
        <MapContainer
            bounds={bounds}
            boundsOptions={{ padding: [50, 50] }}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Draw the route path from OpenRouteService API */}
            {routePath && routePath.length > 0 && (
                <Polyline 
                    positions={routePath} 
                    color="#FF6B35" 
                    weight={5}
                    opacity={0.7}
                    dashArray="10, 5"
                />
            )}
            
            <Marker position={[restaurantLoc.lat, restaurantLoc.lon]} icon={restaurantIcon}>
                <Popup>
                    <div className="text-center">
                        <strong>🍽️ Varaha Swami Restaurant</strong>
                        {distance && duration && (
                            <p className="text-sm mt-1">
                                📍 {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`} away<br/>
                                ⏱️ ~{duration} min drive
                            </p>
                        )}
                    </div>
                </Popup>
            </Marker>
            
            <Marker position={[customerLoc.lat, customerLoc.lon]} icon={customerIcon}>
                <Popup>
                    <div className="text-center">
                        <strong>📍 Your Location</strong>
                    </div>
                </Popup>
            </Marker>
            
            {deliveryLoc && (
                <>
                    <Marker position={[deliveryLoc.lat, deliveryLoc.lon]} icon={deliveryIcon}>
                        <Popup>
                            <div className="text-center">
                                <strong>🛵 Delivery Partner</strong>
                                <p className="text-sm">On the way!</p>
                            </div>
                        </Popup>
                    </Marker>
                    <Polyline 
                        positions={[[deliveryLoc.lat, deliveryLoc.lon], [customerLoc.lat, customerLoc.lon]]} 
                        color="blue" 
                        weight={4}
                        dashArray="5, 10" 
                    />
                </>
            )}
        </MapContainer>
    );
};

export default Map;
