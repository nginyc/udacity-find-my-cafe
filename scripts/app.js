function onGoogleMapsApiLoaded() {
    app.init();
}

const app = {
    cafes: [],

    init: function() {
        this.viewModel = {
            userLocation: ko.observable(null),
            cafes: ko.observableArray([]),
            searchDistanceMeters: ko.observable('2000'),
            cafeSelected: ko.observable(null),
            cafeSelectedDetails: ko.observable(null),
            isMenuOpen: ko.observable(false),
            searchFilterString: ko.observable(''),
            searchAddressString: ko.observable('1 Market Street, San Francisco, CA, USA'),
            isLoading: ko.observable(false),
            onCafeSelected: (cafe) => this._onCafeSelected(cafe),
            onMenuOpenToggle: () => this._onMenuOpenToggle(),
            onSubmitSearch: () => this._onSubmitSearch(),
            onSubmitFilter: () => this._updateFilteredCafes(),
        };

        view.init(this.viewModel);
        googleApi.init();
        foursquareApi.init();
        
        this._onSubmitSearch();
    },

    _onMenuOpenToggle: function() {
        this.viewModel.isMenuOpen(!this.viewModel.isMenuOpen());
    },

    _onCafeSelected: function(cafe) {
        this.viewModel.cafeSelected(cafe);
        this.viewModel.isMenuOpen(false);

        foursquareApi.pullPlaceDetails(cafe.lat, cafe.lng, cafe.name)
            .then((details) => {
                this.viewModel.cafeSelectedDetails(details);
            });
    },

    _updateFilteredCafes: function() {
        const searchFilterString = this.viewModel.searchFilterString();
        const filteredCafes = this.cafes.filter((cafe) => {
            return cafe.name.toLowerCase().includes(searchFilterString.toLowerCase());
        });

        this.viewModel.cafes(filteredCafes);

        if (filteredCafes.length == 0) {
            view.showAlert('No matching cafes!');
        } else {
            this._onCafeSelected(filteredCafes[0]);
        }
    },

    _onSubmitSearch: function() {
        const addressString = this.viewModel.searchAddressString();
        if (addressString.trim()) {
            this.viewModel.isLoading(true);
            googleApi.pullLocationFromAddress(addressString)
                .then((location) => {
                    this.viewModel.isLoading(false);
                    if (!location) {
                        view.showAlert('Unable to find location from address.');
                    } else {
                        this.viewModel.userLocation(location);
                        this._reloadCafes();
                    }
                });
        } else {
            this.viewModel.isLoading(true);
            this._pullUserLocation()
                .then((userLocation) => {
                    this.viewModel.isLoading(false);
                    this.viewModel.userLocation(userLocation);
                    this._reloadCafes();
                });
        }
    },

    _reloadCafes: function() {
        const userLocation = this.viewModel.userLocation();
        const searchDistance = this.viewModel.searchDistanceMeters();
        this.viewModel.isLoading(true);
        googleApi.pullPlacesNearLocation(
            userLocation.lat,
            userLocation.lng,
            searchDistance,
            'cafe'
        ).then((cafes) => {
            this.viewModel.isLoading(false);
            if (cafes.length == 0) {
                view.showAlert('Unable to find any cafes.');
            } else {
                this.cafes = cafes;
                this._updateFilteredCafes();
            }
        });
    },

    _pullUserLocation: function() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported.'));
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }
};
