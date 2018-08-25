function onGoogleMapsApiLoaded() {
    viewModel.init();
}

const viewModel = {
    userLocation: ko.observable(null),
    mapCenter: ko.observable(null),

    init: function() {
        view.init();
        this.userLocation.subscribe(() => this._onUserLocationUpdated());

        this._tryPullUserLocation();
    },

    _onUserLocationUpdated: function() {
        if (!this.userLocation() &&
            this.mapCenter()) {
            this.mapCenter(this.userLocation());
        }
    },

    _tryPullUserLocation: function() {
        if (!navigator.geolocation) {
            return;
        }

        navigator.geolocation.getCurrentPosition((position) => {
            this.userLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
        });
    }
};

const view = {
    DEFAULT_MAP_CENTER: { 
        lat: 1.3466341, 
        lng: 103.805542 
    }, // Center of Singapore

    init: function() {
        viewModel.mapCenter.subscribe(() => this._setMapCenter(viewModel.mapCenter()));
        viewModel.userLocation.subscribe(() => this._setUserLocation(viewModel.userLocation()));

        // ko.applyBindings(new Model());
        this._map = this._makeMap();
    },
    
    _setMapCenter: function(mapCenter) {
        this._map.setCenter({
            lat: mapCenter.lat,
            lng: mapCenter.lng
        });
    },

    _setUserLocation: function(userLocation) {
       if (this._userLocationMarker) {
            this._userLocationMarker.setMap(null);
       }

       this._userLocationMarker = this._makeUserLocationMarker(
           userLocation.lat, 
           userLocation.lng
        );
    },

    _makeUserLocationMarker: function(lat, lng) {
        return new google.maps.Marker({
            icon: {
                url: './images/user-location-marker.png',
            },
            map: this._map,
            position: {
                lat: lat,
                lng: lng
            }
        });
    },

    _makeMap: function() {
        return new google.maps.Map(
            document.getElementById('map'),
            {
                zoom: 12,
                center: this.DEFAULT_MAP_CENTER
            }
        );
    }
}