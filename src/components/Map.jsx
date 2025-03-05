import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/Map.css'
import PropTypes from 'prop-types'
import L from 'leaflet'

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const MapEvents = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng)
    },
  })
  return null
}

MapEvents.propTypes = {
  onLocationSelect: PropTypes.func
}

const Map = ({ center, zoom, marker, onLocationSelect, height = '300px' }) => {
  return (
    <MapContainer 
      center={center} 
      zoom={zoom} 
      style={{ height, width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {marker && <Marker position={marker} />}
      {onLocationSelect && <MapEvents onLocationSelect={onLocationSelect} />}
    </MapContainer>
  )
}

Map.propTypes = {
  center: PropTypes.arrayOf(PropTypes.number).isRequired,
  zoom: PropTypes.number.isRequired,
  marker: PropTypes.shape({
    lat: PropTypes.number,
    lng: PropTypes.number
  }),
  onLocationSelect: PropTypes.func,
  height: PropTypes.string
}

export default Map 