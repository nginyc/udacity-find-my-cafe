/**
 * Called when Google Maps API JS libraries finish loading.
 * Initializes the app
 */
function onGoogleMapsApiLoaded() {
    app.init();
}

const app = {
    /**
     * Default search values for the app
     */
    DEFAULT_SEARCH_DISTANCE: '2000',
    DEFAULT_ADDRESS: '1 Market Street, San Francisco, CA, USA',

    /**
     * Stores the full list of cafes based on location after fetching from Google Maps API
     */
    cafes: [],

    /**
     * Initializes the (Knockout) view model, the view, and google maps & foursquare API wrappers
     */
    init: function () {
        this.viewModel = {
            // Input location to search cafes from
            userLocation: ko.observable(null),

            // Filtered list of cafes shown to the user
            cafes: ko.observableArray([]),

            // Input search distance in meters to search cafes by
            searchDistanceMeters: ko.observable(this.DEFAULT_SEARCH_DISTANCE),

            // Cafe that the user currently selected
            cafeSelected: ko.observable(null),

            // Additional details about the cafe selected, fetched from foursquare
            cafeSelectedDetails: ko.observable(null),

            // Whether the side-menu displaying the list of places is open 
            isMenuOpen: ko.observable(false),

            // Input search filter string to filter cafes by
            searchFilterString: ko.observable(''),

            // Input address string to search a location by
            searchAddressString: ko.observable(this.DEFAULT_ADDRESS),

            // Whether the app is loading. This causes a loading indicator overlay to appear
            isLoading: ko.observable(false),

            // Called when a cafe is selected
            onCafeSelected: (cafe) => this._onCafeSelected(cafe),

            // Called when the menu button is toggled
            onMenuOpenToggle: () => this._onMenuOpenToggle(),

            // Called when the user presses on the search button
            onSubmitSearch: () => this._onSubmitSearch(),

            // Called when the user presses on the filter button
            onSubmitFilter: () => this._updateFilteredCafes(),
        };

        view.init(this.viewModel);
        googleApi.init();
        foursquareApi.init();

        // Start by doing a search with the default search values
        this._onSubmitSearch();
    },

    /**
     * Updates the view model's list of cafes shown, filtered by the search filter string
     */
    _updateFilteredCafes: function () {
        const searchFilterString = this.viewModel.searchFilterString();
        const filteredCafes = this.cafes.filter((cafe) => {
            return cafe.name.toLowerCase()
                .includes(
                    searchFilterString.toLowerCase());
        });

        this.viewModel.cafes(filteredCafes);

        // Show an warning to the user if filtering produces no results
        if (filteredCafes.length == 0) {
            view.showAlert('No matching cafes!');
        } else {
            this._onCafeSelected(filteredCafes[0]);
        }
    },

    /**
     * Re-fetch full list of cafes based on input location, using Google Maps API
     */
    _reloadCafes: function () {
        const userLocation = this.viewModel.userLocation();
        const searchDistance = this.viewModel.searchDistanceMeters();

        this.viewModel.isLoading(true);

        // Do a Google places search based on input location & search distance 
        googleApi.pullPlacesNearLocation(
                userLocation.lat,
                userLocation.lng,
                searchDistance,
                'cafe'
            )
            .then((cafes) => {
                this.viewModel.isLoading(false);

                // Show a warning to the user if searching produces no results
                if (cafes.length == 0) {
                    view.showAlert('Unable to find any cafes');
                } else {
                    this.cafes = cafes;
                    this._updateFilteredCafes();
                }

            })
            .catch((error) => {
                this.viewModel.isLoading(false);
                
                // Show an error to the user if search throws an error
                console.error(error);
                view.showAlert('Error while searching for cafes');
            });
    },

    /**
     * Resolves with the user's current location
     */
    _pullUserLocation: function () {
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
    },

    _onMenuOpenToggle: function () {
        this.viewModel.isMenuOpen(!this.viewModel.isMenuOpen());
    },

    _onCafeSelected: function (cafe) {
        this.viewModel.cafeSelected(cafe);

        // Close the menu when a cafe is selected
        this.viewModel.isMenuOpen(false);

        // Do a Foursquare venue search based on cafe selected 
        foursquareApi.pullPlaceDetails(cafe.lat, cafe.lng, cafe.name)
            .then((details) => {
                // Populate cafe selcted's details
                this.viewModel.cafeSelectedDetails(details);
            });
    },

    _onSubmitSearch: function () {
        const addressString = this.viewModel.searchAddressString();

        // If the address string is non-empty, do Google Maps geocoding to get
        // the corresponding location, and set the user's location as such  
        if (addressString.trim()) {
            this.viewModel.isLoading(true);
            googleApi.pullLocationFromAddress(addressString)
                .then((location) => {
                    this.viewModel.isLoading(false);
                    if (!location) {
                        view.showAlert(
                            'Unable to geocode location from address'
                        );
                    } else {
                        this.viewModel.userLocation(location);
                        this._reloadCafes();
                    }
                })
                .catch((error) => {
                    this.viewModel.isLoading(false);
                    
                    // Show an error to the user if geocoding throws an error
                    console.error(error);
                    view.showAlert(
                        'Error while geocoding location from address'
                    );
                });

        } else {
            // Otherwise, if the address string is empty, try to pull user's current location
            this.viewModel.isLoading(true);
            this._pullUserLocation()
                .then((userLocation) => {
                    this.viewModel.isLoading(false);

                    this.viewModel.userLocation(userLocation);
                    this._reloadCafes();
                })
                .catch((error) => {
                    this.viewModel.isLoading(false);

                    // Show an error to the user if unable to get user's current location
                    console.error(error);

                    view.showAlert(
                        'Error while retrieving user\'s current location'
                    );
                });
        }
    }
};