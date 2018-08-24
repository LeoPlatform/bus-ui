
	$.fn.serializeObject = function() {
		var o = {}, a = this.serializeArray();
		$.each(a, function() {
			var key = this.name
			var s = this.name.split(/\[([^\]]*)\]/g)
			if (this.value === 'true') {
				this.value = true
			} else if (this.value === 'false') {
				this.value = false
			} else if (this.value.length < 21 && this.value.match(/^-?((\d+\.?\d*)|(\.?\d+))$/)) {
				this.value = parseFloat(this.value)
			} else {
				this.value = this.value || ''
			}
			if (s.length > 1) {
				key = s[0]
				if (!o[key]) {
					o[key] = []
				}
				if (o[key][s[1]] !== undefined) {
					if (!o[key][s[1]].push) {
						o[key][s[1]] = [o[key][s[1]]];
					}
					o[key][s[1]].push(this.value)
				} else {
					o[key][s[1]] = this.value
				}
			} else if (o[key] !== undefined) {
				if (!o[key].push) {
					o[key] = [o[key]]
				}
				o[key].push(this.value)
			} else {
				o[key] = this.value
			}
		});
		return o;
	};


	window.LeoKit = {};
	(function(me) {

		me.close = function(dialog, onClose) {
			if ((!onClose || onClose() !== false) && dialog) {
				var element = ((!dialog.hasClass('theme-dialog') && !dialog.hasClass('theme-modal')) ? dialog.closest('.theme-dialog') : dialog).removeClass('theme-dialog-open')
				element = ((element.parent().hasClass('theme-modal')) ? element.parent() : element).removeClass('theme-dialog-open')
				setTimeout(function() {
					element.remove()
					$('.theme-dialog').last().focus()
				}, 200)
			}
		}

		me.center = function(dialog) {
			if (!dialog) {
				return false
			}
			dialog = (dialog.hasClass('theme-modal') ? dialog.find('.theme-dialog') : dialog)
			dialog.css({
				left: (window.innerWidth - parseFloat(dialog.css('width')))/2,
				top: (window.innerHeight - parseFloat(dialog.css('height')))/3,
				position: 'fixed'
			})
		}


		me.modalFull = function() {
			var dialog = me.dialog.apply(this, arguments)
			return dialog.wrap($('<div/>').addClass('theme-modal theme-modal-full')).parent()
		}


		me.modal = function() {
			var dialog = me.dialog.apply(this, arguments)
			return dialog.wrap($('<div/>').addClass('theme-modal').click((event) => {
				if ($(event.target).hasClass('theme-modal')) {
					dialog.focus()
				}
			})).parent()
		}


		me.dialog = function(content, buttons, title, onClose) {
			var dialog = $('<div/>').attr('tabIndex', -1).bind('keydown', function(e) {
				if (e.keyCode == 27 && onClose !== false && $(this).attr('tabIndex')) {
					me.close($(this), onClose)
				}
			})
			$('body').append(dialog)
			var footer = $('<footer/>')
			var header = $('<header />').attr('tabIndex', -2).append($('<span/>').html(title || '')).addClass('theme-dialog-header')
			var primary = '-primary'
			for(var button in buttons) {
				var className = 'theme-button'+primary+((['delete', 'reset'].indexOf(button.toLowerCase()) !== -1) ? '-danger pull-left' : '')
					, label = button
					, action = buttons[button]
				if (typeof action == 'object') {
					className = (action.className || className)
					label = action.label || button
					action = action.action
				}
				footer.prepend($('<button/>').attr('type', primary ? 'submit' : 'button').addClass(className).text(label).click((
					function(action) {
						return function(event) {
							event.preventDefault()
							if (action) {
								if (action( $(this).closest('form').serializeObject(), $(this) ) === false) {
									return
								}
							}
							me.close($(this), onClose)
						}
					})(action)
				))
				primary = ''
			}
			dialog.empty().attr('class', 'theme-dialog').append(
				header.append(
					onClose !== false
					? $('<i class="theme-icon-close"></i>').click(function(e) {
						me.close($(this), onClose)
					})
					: false
				),
				$('<form/>').addClass('theme-form').submit(function(e) { e.preventDefault(); $(this).find('button[type="submit"]').trigger('click') }).append(
					$('<main/>').html(content),
					footer
				)
			).removeClass("theme-dialog-open").show()

			setTimeout(() => {
				dialog.addClass('theme-dialog-open')
				dialog.focus()
				dialog.find('input:not([type=hidden]), select, textarea, button').first().focus().select()
				dialog.find('textarea').bind('keydown', function(e) {
					if (e.keyCode == 9) {
						e.preventDefault()
						var val = this.value,
							start = this.selectionStart,
							end = this.selectionEnd
						this.value = val.substring(0, start) + '\t' + val.substring(end)
						this.selectionStart = this.selectionEnd = start + 1
						return false
					}
				})
				me.center(dialog)
				setTimeout(() => {
					me.center(dialog)
				}, 500)
				dialog.draggable({ handle:'.theme-dialog-header', containment: 'body' })
			}, 1)

			return dialog
		}

		me.alert = function(msg, type) {
			var modal = me.modal(msg, { close: () => {} }).addClass('alert-box' + (type ? ' theme-dialog-'+type: ''))
			if (!type) {
				setTimeout(function() {
					modal.removeClass('theme-dialog-open')
					setTimeout(function() { modal.remove() }, 200)
				}, 5000)
			}
			return modal
		}

		me.confirm = function(msg, buttons, cancel, onClose) {
			if (typeof buttons == 'function') {
				buttons = {
					OK: buttons,
					cancel: cancel
				}
				cancel = onClose
			}
			return me.modal(msg, buttons, undefined, cancel).addClass('theme-dialog-confirm')
		}

		me.prompt = function(title, label, defaultValue, buttons, cancel) {
			var inputBox
			switch(typeof defaultValue) {
				case 'string':
					if (typeof buttons == 'function') {
						buttons = {
							OK: buttons,
							cancel: cancel
						}
					}
				break

				case 'function':
					buttons = {
						OK: defaultValue,
						cancel: cancel
					}
					defaultValue = ''
				break

				case 'object':
					if (typeof buttons === 'object') {
						inputBox = $('<select id="dialog-prompt-value" name="prompt_value" />').css({width:'99%'})
						Object.keys(defaultValue).forEach((value) => {
							inputBox.append($('<option />').attr('value', value).text(defaultValue[value]))
						})
					} else {
						buttons = defaultValue
						defaultValue = ''
					}
				break
			}

			if (!inputBox) {
				inputBox = $('<input id="dialog-prompt-value" name="prompt_value" value="'+defaultValue+'" />').css({width:'100%'})
			}

			var content = $('<div/>').append(
				$('<label/>').text(label),
				inputBox
			)
			return me.modal(content, buttons, title).addClass('prompt-box')
		}

	})(LeoKit);


	window.onresize = function() {
		$('.theme-dialog, .theme.modal').each((index, dialog) => {
			LeoKit.center($(dialog))
		})
	}
