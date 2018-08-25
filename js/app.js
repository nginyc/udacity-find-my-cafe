const Model = function() {
    this.title = ko.observable('Hi!');
};

ko.applyBindings(new Model());