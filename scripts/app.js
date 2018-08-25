function onGoogleMapsApiLoaded() {
    controller.init();
}

const model = {
    init: function() {
    }
};

const controller = {
    init: function() {
        model.init();
        view.init();
    }
};

const view = {
    DEFAULT_LAT_LONG: { lat: 1.3466341, lng: 103.805542 }, // Center of Singapore

    init: function() {
        // ko.applyBindings(new Model());
        this._initMap();
    },

    _initMap: function() {
        this._map = new google.maps.Map(
            document.getElementById('map'),
            {
                zoom: 12,
                center: this.DEFAULT_LAT_LONG
            }
        );
    }
}