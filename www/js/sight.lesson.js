sight.lesson = function(info) {
	this.name = info.name;
	this.subject = info.subject;
	this.entries = info.entries;
	this.type = info.type;
	this.template = sight.templates[info.type];

	// Set on state load().
	this.index = null;
	this.state = null;
	this.focus = null;
	this.list = null;
	this.pos = null;
	this.entry = null;
};

sight.lesson.prototype.load = function(data) {
	var focusData = [];
	if (data) {
		this.state = new BitArray(0, data.state);
		focusData = data.focus;
		this.focus = sight.util.indexKeys(focusData);
	}
	else
		this.state = new BitArray(1);

	// Sort entries into known and unknown.  Build index.
	var known = [];
	var unknown = [];
	this.index = {};
	for (var i = 0; i < this.entries.length; i++) {
		var word = this.entries[i];

		this.index[word] = i;

		if (this.state.get(i))
			known.push(word);
		else if (!this.focus || !this.focus[word])
			unknown.push(word);
	}

	// Shuffle the lists.
	known = _.shuffle(known);
	unknown = _.shuffle(unknown);

	// Grow focus set if any unknown entries exist.
	while (focusData.length < 10 && unknown.length)
		focusData.push(unknown.pop());
	focusData = _.shuffle(focusData);
	this.focus = sight.util.indexKeys(focusData);

	// Push focus set to the beginning of the unknown list.
	unknown = unknown.concat(focusData);

	// Generate sets of 5 known, 5 unknown to work with.
	this.list = [];
	this.pos = 0;
	while (unknown.length || known.length) {
		for (var i = 0; unknown.length && i < 5; i++)
			this.list.push(unknown.pop());

		for (var i = 0; known.length && i < 5; i++)
			this.list.push(known.pop());
	}
	this.positionChanged();
};

sight.lesson.prototype.save = function() {
	return {
		state: this.state.toHexString(),
		focus: _.keys(this.focus)
	};
};

sight.lesson.prototype.isKnown = function(entry) {
	return this.state.get(this.index[entry]);
};

sight.lesson.prototype.toggleKnown = function() {
	this.state.toggle(this.index[this.entry.value]);
	this.entry.known = !this.entry.known;

	if (this.entry.known) {
		// Delete known focused entries to allow new entries to take their place.
		if (this.focus[this.entry.value])
			delete this.focus[this.entry.value];
	} else {
		// Add recently forgotten items back to the focus set if it's not full.
		// This also helps when accidentally toggling an entry.
		if (_.keys(this.focus).length < 10)
			this.focus[this.entry.value] = 1;
	}

	return this.entry.known;
};

sight.lesson.prototype.next = function() {
	if (this.pos + 1 >= this.list.length)
		return false; // No next.

	this.pos++;
	this.positionChanged();
	return true;
};

sight.lesson.prototype.previous = function() {
	if (this.pos <= 0)
		return false; // No previous.

	this.pos--;
	this.positionChanged();
	return true;
};

sight.lesson.prototype.positionChanged = function() {
	var value = this.list[this.pos];
	this.entry = { value: value, known: this.isKnown(value) };
};

// Static

sight.lesson.duplicateCheck = function() {
	var words = {};
	for (var i = 0; i < sight.data.subjects.length; i++) {
		var subjectData = sight.data.subjects[i];
		for (var ii = 0; ii < subjectData.levels.length; ii++) {
			var levelData = subjectData.levels[ii];
			for (var iii = 0; iii < levelData.entries.length; iii++) {
				var word = levelData.entries[iii];
				if (words[word])
					console.log('Duplicate entry ' + word + ' in subject ' + subjectData.name);

				words[word] = 1;
			}
		}
	}
};
