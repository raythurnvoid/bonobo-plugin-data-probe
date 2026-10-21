var __defProp = Object.defineProperty;
var __export = (target, all) => {
	for (var name in all)
		__defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/preact/src/constants.js
var MODE_HYDRATE = 1 << 5;
var MODE_SUSPENDED = 1 << 7;
var INSERT_VNODE = 1 << 2;
var MATCHED = 1 << 1;
var FORCE_PROPS_REVALIDATE = 1 << 0;
var REF_DETACHED = 1 << 3;
var COMPONENT_PROCESSING_EXCEPTION = 1 << 0;
var COMPONENT_PENDING_ERROR = 1 << 1;
var COMPONENT_FORCE = 1 << 2;
var COMPONENT_DIRTY = 1 << 3;
var RESET_MODE = ~(MODE_HYDRATE | MODE_SUSPENDED);
var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
var XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
var MATH_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
var NULL = null;
var UNDEFINED = void 0;
var EMPTY_OBJ =
	/** @type {any} */
	{};
var EMPTY_ARR = [];
var MATHML_TOKEN_ELEMENTS = /^m(i|n|o|s|text|space)$/;

// node_modules/preact/src/util.js
var isArray = Array.isArray;
var slice = EMPTY_ARR.slice;
var assign = Object.assign;
function removeNode(node) {
	if (node && node.parentNode) node.remove();
}

// node_modules/preact/src/diff/catch-error.js
function _catchError(error, vnode, oldVNode, errorInfo) {
	let component, ctor, handled;
	for (; (vnode = vnode._parent);) {
		if (
			(component = vnode._component) &&
			!(component._bits & COMPONENT_PROCESSING_EXCEPTION)
		) {
			component._bits |= COMPONENT_FORCE;
			try {
				ctor = component.constructor;
				if (ctor && ctor.getDerivedStateFromError) {
					component.setState(ctor.getDerivedStateFromError(error));
					handled = component._bits & COMPONENT_DIRTY;
				}
				if (component.componentDidCatch) {
					component.componentDidCatch(error, errorInfo || {});
					handled = component._bits & COMPONENT_DIRTY;
				}
				if (handled) {
					component._bits |= COMPONENT_PENDING_ERROR;
					return;
				}
			} catch (e) {
				error = e;
				handled = 0;
			}
		}
	}
	resetRenderCount();
	throw error;
}

// node_modules/preact/src/options.js
var options = {
	_catchError,
};
var options_default = options;

// node_modules/preact/src/create-element.js
var vnodeId = 0;
function createElement(type, props, children) {
	let normalizedProps = {},
		key,
		ref,
		i3,
		length = arguments.length;
	for (i3 in props) {
		if (i3 == "key") key = props[i3];
		else if (i3 == "ref" && typeof type != "function") ref = props[i3];
		else normalizedProps[i3] = props[i3];
	}
	if (length > 2) {
		normalizedProps.children = length > 3 ? slice.call(arguments, 2) : children;
	}
	return createVNode(type, normalizedProps, key, ref, NULL);
}
function cloneElement(vnode, props, children) {
	let normalizedProps = assign({}, vnode.props),
		key,
		ref,
		i3,
		length = arguments.length;
	for (i3 in props) {
		if (i3 == "key") key = props[i3];
		else if (i3 == "ref" && typeof vnode.type != "function") ref = props[i3];
		else normalizedProps[i3] = props[i3];
	}
	if (length > 2) {
		normalizedProps.children = length > 3 ? slice.call(arguments, 2) : children;
	}
	return createVNode(
		vnode.type,
		normalizedProps,
		key !== UNDEFINED ? key : vnode.key,
		ref !== UNDEFINED ? ref : vnode.ref,
		NULL,
	);
}
function createVNode(type, props, key, ref, original) {
	const vnode = {
		type,
		props,
		key,
		ref,
		_children: NULL,
		_parent: NULL,
		_depth: 0,
		_dom: NULL,
		_component: NULL,
		constructor: UNDEFINED,
		_original: original || ++vnodeId,
		_index: -1,
		_flags: 0,
	};
	if (!original && options_default.vnode) options_default.vnode(vnode);
	return vnode;
}
function createRef() {
	return { current: NULL };
}
function Fragment(props) {
	return props.children;
}

// node_modules/preact/src/component.js
function BaseComponent(props, context) {
	this.props = props;
	this.context = context;
	this._bits = 0;
}
BaseComponent.prototype.setState = function (update, callback) {
	let s = this._nextState;
	if (!s || s == this.state) {
		s = this._nextState = assign({}, this.state);
	}
	if (typeof update == "function") {
		update = update(assign({}, s), this.props);
	}
	if (update) {
		assign(s, update);
	} else {
		return;
	}
	if (this._vnode) {
		if (callback) {
			this._stateCallbacks.push(callback);
		}
		enqueueRender(this);
	}
};
BaseComponent.prototype.forceUpdate = function (callback) {
	if (this._vnode) {
		this._bits |= COMPONENT_FORCE;
		if (callback) this._renderCallbacks.push(callback);
		enqueueRender(this);
	}
};
BaseComponent.prototype.render = Fragment;
function getDomSibling(vnode, childIndex) {
	if (childIndex == NULL) {
		return vnode._parent
			? getDomSibling(vnode._parent, vnode._index + 1)
			: NULL;
	}
	let sibling;
	for (; childIndex < vnode._children.length; childIndex++) {
		sibling = vnode._children[childIndex];
		if (sibling && sibling._dom) {
			return sibling._dom;
		}
	}
	return typeof vnode.type == "function" && !vnode.props._parentDom
		? getDomSibling(vnode)
		: NULL;
}
function renderComponent(component) {
	const oldVNode = component._vnode,
		oldDom = oldVNode._dom,
		commitQueue = [],
		refQueue = [];
	const parentDom = component._parentDom;
	if (parentDom) {
		const newVNode = assign({ constructor: UNDEFINED }, oldVNode);
		newVNode._original = oldVNode._original + 1;
		if (options_default.vnode) options_default.vnode(newVNode);
		diff(
			parentDom,
			newVNode,
			oldVNode,
			component._globalContext,
			parentDom.namespaceURI,
			oldVNode._flags & MODE_HYDRATE ? [oldDom] : NULL,
			commitQueue,
			oldDom || getDomSibling(oldVNode),
			oldVNode._flags & MODE_HYDRATE,
			refQueue,
		);
		newVNode._original = oldVNode._original;
		newVNode._parent._children[newVNode._index] = newVNode;
		commitRoot(commitQueue, newVNode, refQueue);
		oldVNode._parent = oldVNode._dom = NULL;
		if (newVNode._dom != oldDom) {
			updateParentDomPointers(newVNode);
		}
	}
}
function updateParentDomPointers(vnode) {
	if ((vnode = vnode._parent) && vnode._component && !vnode.props._parentDom) {
		vnode._dom = NULL;
		vnode._children.some((child) => child && (vnode._dom = child._dom));
		return updateParentDomPointers(vnode);
	}
}
var rerenderQueue = [];
var prevDebounce;
var rerenderCount = 0;
function resetRenderCount() {
	rerenderCount = 0;
}
function enqueueRender(c) {
	if (
		(!(c._bits & COMPONENT_DIRTY) &&
			(c._bits |= COMPONENT_DIRTY) &&
			rerenderQueue.push(c) &&
			!rerenderCount++) ||
		prevDebounce != options_default.debounceRendering
	) {
		prevDebounce = options_default.debounceRendering;
		(prevDebounce || queueMicrotask)(process);
	}
}
var depthSort = (a, b) => a._vnode._depth - b._vnode._depth;
function process() {
	try {
		let c,
			l = 1;
		while (rerenderQueue.length) {
			if (rerenderQueue.length > l) {
				rerenderQueue.sort(depthSort);
			}
			c = rerenderQueue.shift();
			l = rerenderQueue.length;
			if (c._bits & COMPONENT_DIRTY) {
				renderComponent(c);
			}
		}
	} finally {
		rerenderQueue.length = rerenderCount = 0;
	}
}

// node_modules/preact/src/diff/children.js
function diffChildren(
	parentDom,
	renderResult,
	newParentVNode,
	oldParentVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	oldDom,
	isHydrating,
	refQueue,
) {
	let i3, oldVNode, childVNode, newDom, firstChildDom;
	let oldChildren = oldParentVNode._children || EMPTY_ARR;
	let newChildrenLength = renderResult.length;
	oldDom = constructNewChildrenArray(
		newParentVNode,
		renderResult,
		oldChildren,
		oldDom,
		newChildrenLength,
	);
	for (i3 = 0; i3 < newChildrenLength; i3++) {
		childVNode = newParentVNode._children[i3];
		if (childVNode == NULL) continue;
		oldVNode =
			(~childVNode._index && oldChildren[childVNode._index]) || EMPTY_OBJ;
		childVNode._index = i3;
		let result2 = diff(
			parentDom,
			childVNode,
			oldVNode,
			globalContext,
			namespace,
			excessDomChildren,
			commitQueue,
			oldDom,
			isHydrating,
			refQueue,
		);
		newDom = childVNode._dom;
		if (oldVNode.ref != childVNode.ref || oldVNode._flags & REF_DETACHED) {
			if (oldVNode.ref) applyRef(oldVNode.ref, NULL, childVNode, oldVNode);
			if (childVNode.ref) {
				refQueue.push(
					childVNode.ref,
					childVNode._component || newDom,
					childVNode,
				);
			}
		}
		firstChildDom = firstChildDom || newDom;
		if (childVNode._flags & INSERT_VNODE) {
			oldDom = insert(childVNode, oldDom, parentDom, !oldVNode._original);
			if (oldVNode._dom) {
				oldVNode._dom = NULL;
			}
		} else if (typeof childVNode.type == "function" && result2 !== UNDEFINED) {
			oldDom = result2;
		} else if (newDom) {
			oldDom = newDom.nextSibling;
		}
		childVNode._flags &= ~(INSERT_VNODE | MATCHED);
	}
	newParentVNode._dom = firstChildDom;
	return oldDom;
}
function constructNewChildrenArray(
	newParentVNode,
	renderResult,
	oldChildren,
	oldDom,
	newChildrenLength,
) {
	let i3;
	let childVNode;
	let oldVNode;
	let oldChildrenLength = oldChildren.length,
		remainingOldChildren = oldChildrenLength;
	let skew = 0;
	let moved = false;
	let newChildren = (newParentVNode._children = Array(newChildrenLength));
	for (i3 = 0; i3 < newChildrenLength; i3++) {
		childVNode = renderResult[i3];
		if (
			childVNode == NULL ||
			typeof childVNode == "boolean" ||
			typeof childVNode == "function"
		) {
			newChildren[i3] = NULL;
			continue;
		} else if (
			typeof childVNode != "object" ||
			childVNode.constructor == String
		) {
			childVNode = newChildren[i3] = createVNode(NULL, childVNode);
		} else if (isArray(childVNode)) {
			childVNode = newChildren[i3] = createVNode(Fragment, {
				children: childVNode,
			});
		} else if (childVNode.constructor === UNDEFINED && childVNode._depth) {
			childVNode = newChildren[i3] = createVNode(
				childVNode.type,
				childVNode.props,
				childVNode.key,
				childVNode.ref,
				childVNode._original,
			);
		} else {
			newChildren[i3] = childVNode;
		}
		const skewedIndex = i3 + skew;
		childVNode._parent = newParentVNode;
		childVNode._depth = newParentVNode._depth + 1;
		const matchingIndex = (childVNode._index = findMatchingIndex(
			childVNode,
			oldChildren,
			skewedIndex,
			remainingOldChildren,
		));
		oldVNode = NULL;
		if (~matchingIndex) {
			oldVNode = oldChildren[matchingIndex];
			remainingOldChildren--;
			if (oldVNode) {
				oldVNode._flags |= MATCHED;
			}
		}
		if (!oldVNode || !oldVNode._original) {
			if (!~matchingIndex) {
				if (newChildrenLength > oldChildrenLength) {
					skew--;
				} else if (newChildrenLength < oldChildrenLength) {
					skew++;
				}
			}
			if (typeof childVNode.type != "function") {
				childVNode._flags |= INSERT_VNODE;
			}
		} else {
			childVNode._flags |= MATCHED;
			if (matchingIndex == skewedIndex - 1) {
				skew--;
			} else if (matchingIndex == skewedIndex + 1) {
				skew++;
			} else if (matchingIndex != skewedIndex) {
				if (matchingIndex > skewedIndex) {
					skew--;
				} else {
					skew++;
				}
				moved = true;
			}
		}
	}
	if (moved) {
		let tails = [];
		let lisLengths = [];
		for (i3 = 0; i3 < newChildrenLength; i3++) {
			childVNode = newChildren[i3];
			if (childVNode && childVNode._flags & MATCHED) {
				let lo = 0,
					hi = tails.length;
				while (lo < hi) {
					const mid = (lo + hi) >> 1;
					if (tails[mid] < childVNode._index) {
						lo = mid + 1;
					} else {
						hi = mid;
					}
				}
				tails[lo] = childVNode._index;
				lisLengths[i3] = lo + 1;
			}
		}
		skew = tails.length;
		while (i3--) {
			if (lisLengths[i3]) {
				if (lisLengths[i3] == skew) {
					skew--;
				} else {
					newChildren[i3]._flags |= INSERT_VNODE;
				}
			}
		}
	}
	if (remainingOldChildren) {
		for (i3 = 0; i3 < oldChildrenLength; i3++) {
			oldVNode = oldChildren[i3];
			if (oldVNode && !(oldVNode._flags & MATCHED)) {
				if (oldVNode._dom == oldDom) {
					oldDom = getDomSibling(oldVNode);
				}
				unmount(oldVNode, oldVNode);
			}
		}
	}
	return oldDom;
}
function insert(parentVNode, oldDom, parentDom, isMounting) {
	if (typeof parentVNode.type == "function") {
		if (parentVNode.props._parentDom) return oldDom;
		let children = parentVNode._children;
		if (children) {
			for (let i3 = 0; i3 < children.length; i3++) {
				if (children[i3]) {
					children[i3]._parent = parentVNode;
					oldDom = insert(children[i3], oldDom, parentDom, false);
				}
			}
		}
		return oldDom;
	} else {
		if (oldDom && !oldDom.parentNode) {
			oldDom = getDomSibling(parentVNode);
			if (oldDom && !oldDom.parentNode) oldDom = NULL;
		}
		let next = oldDom;
		while (next && next.nodeType == 8) next = next.nextSibling;
		if (parentVNode._dom != next) {
			if (!isMounting && parentDom.moveBefore && parentVNode._dom.parentNode) {
				parentDom.moveBefore(parentVNode._dom, oldDom);
			} else {
				parentDom.insertBefore(parentVNode._dom, oldDom || NULL);
			}
		}
		oldDom = parentVNode._dom;
	}
	while ((oldDom = oldDom && oldDom.nextSibling) && oldDom.nodeType == 8);
	return oldDom;
}
function toChildArray(children, out) {
	out = out || [];
	if (children != NULL && typeof children != "boolean") {
		if (isArray(children)) {
			children.some((child) => {
				toChildArray(child, out);
			});
		} else {
			out.push(children);
		}
	}
	return out;
}
function findMatchingIndex(
	childVNode,
	oldChildren,
	skewedIndex,
	remainingOldChildren,
) {
	const key = childVNode.key;
	const type = childVNode.type;
	let oldVNode = oldChildren[skewedIndex];
	const matched = oldVNode && !(oldVNode._flags & MATCHED);
	let shouldSearch =
		// (typeof type != 'function' || type === Fragment || key) &&
		// The ternary keeps this a Smi comparison; `> matched` would compare
		// number to boolean which V8 can't serve from the fast path.
		remainingOldChildren > (matched ? 1 : 0);
	if (
		(oldVNode === NULL && key == NULL) ||
		(matched && key == oldVNode.key && type == oldVNode.type)
	) {
		return skewedIndex;
	} else if (shouldSearch) {
		let x = skewedIndex - 1;
		let y = skewedIndex + 1;
		while (x >= 0 || y < oldChildren.length) {
			const childIndex = x >= 0 ? x-- : y++;
			oldVNode = oldChildren[childIndex];
			if (
				oldVNode &&
				!(oldVNode._flags & MATCHED) &&
				key == oldVNode.key &&
				type == oldVNode.type
			) {
				return childIndex;
			}
		}
	}
	return -1;
}

// node_modules/preact/src/diff/props.js
var EVENT_DISPATCHED = /* @__PURE__ */ Symbol();
function setStyle(style, key, value) {
	if (value == NULL) value = "";
	if (key[0] == "-") {
		style.setProperty(key, value);
	} else {
		style[key] = value;
	}
}
var CAPTURE_REGEX = /(PointerCapture)$|Capture$/i;
var eventClock = 0;
function setProperty(dom, name, value, oldValue, namespace) {
	let useCapture;
	o: if (name == "style") {
		if (typeof value == "string") {
			dom.style.cssText = value;
		} else {
			if (typeof oldValue == "string") {
				dom.style.cssText = oldValue = "";
			}
			if (oldValue) {
				for (name in oldValue) {
					if (!(value && name in value)) {
						setStyle(dom.style, name, "");
					}
				}
			}
			if (value) {
				for (name in value) {
					if (!oldValue || value[name] != oldValue[name]) {
						setStyle(dom.style, name, value[name]);
					}
				}
			}
		}
	} else if (name[0] == "o" && name[1] == "n") {
		(dom._listeners || (dom._listeners = {}))[name] = value;
		if (!value || !oldValue) {
			const proxy =
				eventProxies[name] || (eventProxies[name] = createEventProxy(name));
			(dom._attached || (dom._attached = {}))[name] = eventClock;
			useCapture = name != (name = name.replace(CAPTURE_REGEX, "$1"));
			name = name.slice(2);
			if (name[0] < "a") name = name.toLowerCase();
			if (value) {
				dom.addEventListener(name, proxy, useCapture);
			} else {
				dom.removeEventListener(name, proxy, useCapture);
			}
		}
	} else {
		if (namespace == SVG_NAMESPACE) {
			name = name.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
		} else if (
			name != "width" &&
			name != "height" &&
			name != "href" &&
			name != "list" &&
			name != "form" && // Default value in browsers is `-1` and an empty string is
			// cast to `0` instead
			name != "tabIndex" &&
			name != "download" &&
			name != "rowSpan" &&
			name != "colSpan" &&
			name != "role" &&
			name != "popover" &&
			name in dom
		) {
			try {
				dom[name] = value == NULL ? "" : value;
				break o;
			} catch (e) {}
		}
		if (typeof value == "function") {
		} else if (value != NULL && (value !== false || name[4] == "-")) {
			dom.setAttribute(name, name == "popover" && value == true ? "" : value);
		} else {
			dom.removeAttribute(name);
		}
	}
}
function createEventProxy(name) {
	return function (e) {
		if (this._listeners) {
			const eventHandler = this._listeners[name];
			if (e[EVENT_DISPATCHED] == NULL) {
				e[EVENT_DISPATCHED] = eventClock++;
			} else if (e[EVENT_DISPATCHED] < this._attached[name]) {
				return;
			}
			return eventHandler(options_default.event ? options_default.event(e) : e);
		}
	};
}
var eventProxies = {};

// node_modules/preact/src/diff/index.js
function diff(
	parentDom,
	newVNode,
	oldVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	oldDom,
	isHydrating,
	refQueue,
) {
	let tmp,
		resumed,
		newType = newVNode.type;
	if (newVNode.constructor !== UNDEFINED) return NULL;
	if (
		oldVNode._flags & MODE_SUSPENDED && // @ts-expect-error This is MODE_HYDRATE or 0
		((isHydrating = oldVNode._flags & MODE_HYDRATE),
		(tmp = oldVNode._component._excess))
	) {
		newVNode._flags |= isHydrating;
		resumed = excessDomChildren = [];
		if (tmp.nodeType == 8) {
			for (
				let depth = 1, node = tmp.nextSibling;
				node;
				node = node.nextSibling
			) {
				if (node.nodeType == 8) {
					if (node.data.startsWith("$s")) depth++;
					else if (node.data.startsWith("/$s") && !--depth) break;
				}
				excessDomChildren.push(node);
			}
		} else {
			excessDomChildren.push(tmp);
		}
		oldDom = excessDomChildren[0];
	}
	if ((tmp = options_default._diff)) tmp(newVNode);
	outer: if (typeof newType == "function") {
		let oldCommitQueueLength = commitQueue.length;
		try {
			let c,
				oldProps,
				oldState,
				snapshot,
				newProps = newVNode.props;
			const isClassComponent = (tmp = newType.prototype) && tmp.render;
			tmp = newType.contextType;
			const provider = tmp && globalContext[tmp._id];
			const componentContext = tmp
				? provider
					? provider.props.value
					: tmp._defaultValue
				: globalContext;
			if (oldVNode._component) {
				c = newVNode._component = oldVNode._component;
				if (c._bits & COMPONENT_PENDING_ERROR) {
					c._bits |= COMPONENT_PROCESSING_EXCEPTION;
				}
			} else {
				if (isClassComponent) {
					newVNode._component = c = new newType(newProps, componentContext);
				} else {
					newVNode._component = c = new BaseComponent(
						newProps,
						componentContext,
					);
					c.constructor = newType;
					c.render = doRender;
				}
				if (provider) provider.sub(c);
				if (!c.state) c.state = {};
				c._globalContext = globalContext;
				c._bits |= COMPONENT_DIRTY;
				c._renderCallbacks = [];
				c._stateCallbacks = [];
			}
			if (isClassComponent) {
				if (!c._nextState) c._nextState = c.state;
				if (newType.getDerivedStateFromProps) {
					if (c._nextState == c.state) {
						c._nextState = assign({}, c._nextState);
					}
					assign(
						c._nextState,
						newType.getDerivedStateFromProps(newProps, c._nextState),
					);
				}
			}
			oldProps = c.props;
			oldState = c.state;
			c._vnode = newVNode;
			if (!oldVNode._component) {
				if (
					isClassComponent &&
					!newType.getDerivedStateFromProps &&
					c.componentWillMount
				) {
					c.componentWillMount();
				}
				if (isClassComponent && c.componentDidMount) {
					c._renderCallbacks.push(c.componentDidMount);
				}
			} else {
				if (
					isClassComponent &&
					!newType.getDerivedStateFromProps &&
					newProps !== oldProps &&
					c.componentWillReceiveProps
				) {
					c.componentWillReceiveProps(newProps, componentContext);
				}
				if (
					(newVNode._original == oldVNode._original &&
						!(c._bits & COMPONENT_DIRTY)) ||
					(!(c._bits & COMPONENT_FORCE) &&
						c.shouldComponentUpdate &&
						c.shouldComponentUpdate(
							newProps,
							c._nextState,
							componentContext,
						) === false)
				) {
					if (newVNode._original != oldVNode._original) {
						c.props = newProps;
						c.state = c._nextState;
						c._bits &= ~COMPONENT_DIRTY;
					}
					newVNode._dom = oldVNode._dom;
					newVNode._children = oldVNode._children;
					newVNode._children.some((vnode) => {
						if (vnode) vnode._parent = newVNode;
					});
					EMPTY_ARR.push.apply(c._renderCallbacks, c._stateCallbacks);
					c._stateCallbacks = [];
					if (c._renderCallbacks.length) {
						commitQueue.push(c);
					}
					oldDom = getDomSibling(oldVNode);
					break outer;
				}
				if (c.componentWillUpdate) {
					c.componentWillUpdate(newProps, c._nextState, componentContext);
				}
				if (isClassComponent && c.componentDidUpdate) {
					c._renderCallbacks.push(() => {
						c.componentDidUpdate(oldProps, oldState, snapshot);
					});
				}
			}
			c.context = componentContext;
			c.props = newProps;
			c._parentDom = parentDom;
			c._bits &= ~COMPONENT_FORCE;
			let renderHook = options_default._render,
				count = 0;
			if (isClassComponent) {
				c.state = c._nextState;
				c._bits &= ~COMPONENT_DIRTY;
				if (renderHook) renderHook(newVNode);
				tmp = c.render(c.props, c.state, c.context);
				EMPTY_ARR.push.apply(c._renderCallbacks, c._stateCallbacks);
				c._stateCallbacks = [];
			} else {
				do {
					c._bits &= ~COMPONENT_DIRTY;
					if (renderHook) renderHook(newVNode);
					tmp = c.render(c.props, c.state, c.context);
					c.state = c._nextState;
				} while (c._bits & COMPONENT_DIRTY && ++count < 25);
			}
			c.state = c._nextState;
			if (c.getChildContext) {
				globalContext = assign({}, globalContext, c.getChildContext());
			}
			if (
				isClassComponent &&
				oldVNode._component &&
				c.getSnapshotBeforeUpdate
			) {
				snapshot = c.getSnapshotBeforeUpdate(oldProps, oldState);
			}
			const renderResult =
				tmp && tmp.type === Fragment && tmp.key == NULL
					? tmp.props.children
					: tmp;
			if (newProps._parentDom) {
				tmp = oldDom;
				parentDom = newProps._parentDom;
				namespace = parentDom.namespaceURI;
				isHydrating = excessDomChildren = NULL;
				if (oldVNode.props && oldVNode.props._parentDom != parentDom) {
					oldVNode._children.some((child) => {
						if (child) unmount(child, child);
					});
					oldVNode._children = NULL;
				}
				oldDom = oldVNode._children ? getDomSibling(oldVNode, 0) : NULL;
			}
			oldDom = diffChildren(
				parentDom,
				isArray(renderResult) ? renderResult : [renderResult],
				newVNode,
				oldVNode,
				globalContext,
				namespace,
				excessDomChildren,
				commitQueue,
				oldDom,
				isHydrating,
				refQueue,
			);
			if (newProps._parentDom) {
				newVNode._dom = NULL;
				oldDom = tmp;
			}
			newVNode._flags &= RESET_MODE;
			if (oldVNode._flags & MODE_SUSPENDED) c._excess = NULL;
			if (resumed) resumed.some(removeNode);
			if (c._renderCallbacks.length) {
				commitQueue.push(c);
			}
			if (c._bits & COMPONENT_PROCESSING_EXCEPTION) {
				c._bits &= ~(COMPONENT_PROCESSING_EXCEPTION | COMPONENT_PENDING_ERROR);
			}
		} catch (e) {
			commitQueue.length = oldCommitQueueLength;
			newVNode._original = NULL;
			if (isHydrating || excessDomChildren) {
				if (e.then) {
					let commentMarkersToFind = 0,
						startMarker;
					newVNode._flags |= isHydrating
						? MODE_HYDRATE | MODE_SUSPENDED
						: MODE_SUSPENDED;
					if (excessDomChildren) {
						let i3 = excessDomChildren.indexOf(oldDom || UNDEFINED),
							child;
						if (!~i3) i3 = excessDomChildren.length;
						while ((child = excessDomChildren[i3 - 1]) && child.nodeType == 8) {
							i3--;
						}
						for (; i3 < excessDomChildren.length; i3++) {
							child = excessDomChildren[i3];
							if (!child) continue;
							excessDomChildren[i3] = NULL;
							if (child.nodeType == 8) {
								if (child.data.startsWith("$s")) {
									if (!commentMarkersToFind++) startMarker = child;
								} else if (
									commentMarkersToFind &&
									child.data.startsWith("/$s") &&
									!--commentMarkersToFind
								) {
									oldDom = child;
									break;
								}
							} else if (!commentMarkersToFind) {
								break;
							}
						}
					}
					if (!startMarker) {
						while (oldDom && oldDom.nodeType == 8 && oldDom.nextSibling) {
							oldDom = oldDom.nextSibling;
						}
						startMarker = oldDom;
					}
					if (!newVNode._component._excess) {
						newVNode._component._excess = startMarker;
					}
					newVNode._dom = oldDom;
				} else if (excessDomChildren) {
					excessDomChildren.some(removeNode);
				}
			} else {
				newVNode._dom = oldVNode._dom;
			}
			if (!newVNode._children) {
				newVNode._children = oldVNode._children || [];
			}
			if (!e.then) markAsForce(newVNode);
			options_default._catchError(e, newVNode, oldVNode);
		}
	} else {
		oldDom = newVNode._dom = diffElementNodes(
			oldVNode._dom,
			newVNode,
			oldVNode,
			globalContext,
			namespace,
			excessDomChildren,
			commitQueue,
			isHydrating,
			refQueue,
			parentDom,
		);
	}
	if ((tmp = options_default.diffed)) tmp(newVNode);
	return newVNode._flags & MODE_SUSPENDED ? UNDEFINED : oldDom;
}
function markAsForce(vnode) {
	if (vnode) {
		if (vnode._component) vnode._component._bits |= COMPONENT_FORCE;
		if (vnode._children) vnode._children.some(markAsForce);
	}
}
function commitRoot(commitQueue, root, refQueue) {
	for (let i3 = 0; i3 < refQueue.length;) {
		applyRef(refQueue[i3++], refQueue[i3++], refQueue[i3++]);
	}
	if (options_default._commit) options_default._commit(root, commitQueue);
	commitQueue.some((c) => {
		try {
			commitQueue = c._renderCallbacks;
			c._renderCallbacks = [];
			commitQueue.some((cb) => {
				cb.call(c);
			});
		} catch (e) {
			options_default._catchError(e, c._vnode);
		}
	});
}
function diffElementNodes(
	dom,
	newVNode,
	oldVNode,
	globalContext,
	namespace,
	excessDomChildren,
	commitQueue,
	isHydrating,
	refQueue,
	parentDom,
) {
	let oldProps = oldVNode.props || EMPTY_OBJ;
	const newProps = newVNode.props;
	const nodeType =
		/** @type {string} */
		newVNode.type;
	let i3;
	let newHtml;
	let oldHtml;
	let newChildren;
	let value;
	let inputValue;
	let checked;
	if (nodeType == "svg") namespace = SVG_NAMESPACE;
	else if (nodeType == "math") namespace = MATH_NAMESPACE;
	else if (!namespace) namespace = XHTML_NAMESPACE;
	if (excessDomChildren) {
		for (i3 = 0; i3 < excessDomChildren.length; i3++) {
			value = excessDomChildren[i3];
			if (
				value &&
				(nodeType ? value.localName == nodeType : value.nodeType == 3)
			) {
				dom = value;
				excessDomChildren[i3] = NULL;
				break;
			}
		}
	}
	if (!dom) {
		const doc = parentDom.ownerDocument || document;
		if (!nodeType) {
			return doc.createTextNode(newProps);
		}
		dom = doc.createElementNS(namespace, nodeType, newProps.is && newProps);
		if (isHydrating) {
			if (options_default._hydrationMismatch)
				options_default._hydrationMismatch(newVNode, excessDomChildren);
			isHydrating = false;
		}
		excessDomChildren = NULL;
	}
	if (!nodeType) {
		if (oldProps !== newProps && (!isHydrating || dom.data != newProps)) {
			dom.data = newProps;
		}
	} else {
		parentDom = nodeType == "template" ? dom.content : dom;
		excessDomChildren =
			nodeType == "textarea" && newProps.defaultValue != NULL
				? NULL
				: excessDomChildren && slice.call(parentDom.childNodes);
		if (!isHydrating && excessDomChildren) {
			oldProps = {};
			for (i3 = 0; i3 < dom.attributes.length; i3++) {
				value = dom.attributes[i3];
				oldProps[value.name] = value.value;
			}
		}
		for (i3 in oldProps) {
			value = oldProps[i3];
			if (i3 == "dangerouslySetInnerHTML") {
				oldHtml = value;
			} else if (
				i3 != "children" &&
				!(i3 in newProps) &&
				!(i3 == "value" && "defaultValue" in newProps) &&
				!(i3 == "checked" && "defaultChecked" in newProps)
			) {
				setProperty(dom, i3, NULL, value, namespace);
			}
		}
		const shouldRevalidateProps = oldVNode._flags & FORCE_PROPS_REVALIDATE;
		for (i3 in newProps) {
			value = newProps[i3];
			if (i3 == "children") {
				newChildren = value;
			} else if (i3 == "dangerouslySetInnerHTML") {
				newHtml = value;
			} else if (i3 == "value") {
				inputValue = value;
			} else if (i3 == "checked") {
				checked = value;
			} else if (
				(!isHydrating || typeof value == "function") &&
				(oldProps[i3] !== value || (shouldRevalidateProps && value != NULL))
			) {
				setProperty(dom, i3, value, oldProps[i3], namespace);
			}
		}
		if (newHtml) {
			if (
				!isHydrating &&
				(!oldHtml ||
					(newHtml.__html != oldHtml.__html && newHtml.__html != dom.innerHTML))
			) {
				dom.innerHTML = newHtml.__html;
			}
			newVNode._children = [];
		} else {
			if (oldHtml) dom.textContent = "";
			if (
				nodeType == "foreignObject" ||
				(namespace == MATH_NAMESPACE && MATHML_TOKEN_ELEMENTS.test(nodeType))
			) {
				namespace = XHTML_NAMESPACE;
			}
			diffChildren(
				parentDom,
				isArray(newChildren) ? newChildren : [newChildren],
				newVNode,
				oldVNode,
				globalContext,
				namespace,
				excessDomChildren,
				commitQueue,
				excessDomChildren
					? excessDomChildren[0]
					: oldVNode._children && getDomSibling(oldVNode, 0),
				isHydrating,
				refQueue,
			);
			if (excessDomChildren) excessDomChildren.some(removeNode);
		}
		if (!isHydrating || nodeType == "textarea") {
			i3 = "value";
			if (nodeType == "progress" && inputValue == NULL) {
				dom.removeAttribute(i3);
			} else if (
				inputValue != UNDEFINED && // #2756 For the <progress>-element the initial value is 0,
				// despite the attribute not being present. When the attribute
				// is missing the progress bar is treated as indeterminate.
				// To fix that we'll always update it when it is 0 for progress elements
				(inputValue !== dom[i3] || (nodeType == "progress" && !inputValue))
			) {
				setProperty(dom, i3, inputValue, oldProps[i3], namespace);
			}
			i3 = "checked";
			if (checked != UNDEFINED && checked != dom[i3]) {
				setProperty(dom, i3, checked, oldProps[i3], namespace);
			}
		}
	}
	return dom;
}
function applyRef(ref, value, vnode, owner) {
	try {
		if (typeof ref == "function") {
			if (value) value._refCleanup = ref(value) || 1;
			else if (
				owner &&
				(owner = owner._component || owner._dom) &&
				(value = owner._refCleanup)
			) {
				owner._refCleanup = NULL;
				if (typeof value == "function") value();
				else ref(NULL);
			}
		} else ref.current = value;
	} catch (e) {
		options_default._catchError(e, vnode);
	}
}
function unmount(vnode, parentVNode, skipRemove) {
	let r;
	if (options_default.unmount) options_default.unmount(vnode);
	if ((r = vnode.ref) && (!r.current || r.current == vnode._dom)) {
		applyRef(r, NULL, parentVNode, vnode);
	}
	if ((r = vnode._component)) {
		if (r.componentWillUnmount) {
			try {
				r.componentWillUnmount();
			} catch (e) {
				options_default._catchError(e, parentVNode);
			}
		}
		r._parentDom = r._globalContext = NULL;
	}
	if ((r = vnode._children)) {
		for (let i3 = 0; i3 < r.length; i3++) {
			if (r[i3]) {
				unmount(
					r[i3],
					parentVNode,
					// A portal's children live in another container, so a removed
					// host ancestor doesn't detach them; always remove them.
					typeof vnode.type == "function"
						? skipRemove && !vnode.props._parentDom
						: true,
				);
			}
		}
	}
	if ((r = vnode._dom)) {
		if (!skipRemove) removeNode(r);
		if (r._listeners) r._listeners = NULL;
	}
	vnode._dom = vnode._component = vnode._parent = NULL;
}
function doRender(props, state, context) {
	return this.constructor(props, context);
}

// node_modules/preact/src/render.js
function render(vnode, parentDom) {
	if (options_default._root) options_default._root(vnode, parentDom);
	if (parentDom.nodeType == 9) {
		parentDom = parentDom.documentElement;
	}
	let isHydrating = vnode && vnode._flags & MODE_HYDRATE;
	let oldVNode = isHydrating ? NULL : parentDom._children;
	parentDom._children = createVNode(Fragment, { children: [vnode] });
	let commitQueue = [],
		refQueue = [];
	diff(
		parentDom,
		// Determine the new vnode tree and store it on the DOM element on
		// our custom `_children` property.
		parentDom._children,
		oldVNode || EMPTY_OBJ,
		EMPTY_OBJ,
		parentDom.namespaceURI,
		oldVNode
			? NULL
			: parentDom.firstChild
				? slice.call(parentDom.childNodes)
				: NULL,
		commitQueue,
		oldVNode ? oldVNode._dom : parentDom.firstChild,
		// @ts-expect-error we are doing a bit-wise operation so it's either 0 or true
		isHydrating,
		refQueue,
	);
	commitRoot(commitQueue, parentDom._children, refQueue);
	parentDom._children.props.children = NULL;
}
function hydrate(vnode, parentDom) {
	if (vnode && typeof vnode == "object") {
		vnode._flags |= MODE_HYDRATE;
	}
	render(vnode, parentDom);
}

// node_modules/preact/src/create-context.js
var i = 0;
function createContext(defaultValue) {
	function Context(props) {
		if (!this.getChildContext) {
			let subs = /* @__PURE__ */ new Set();
			let ctx = {};
			ctx[Context._id] = this;
			this.getChildContext = () => ctx;
			this.shouldComponentUpdate = function (_props) {
				if (this.props.value != _props.value) {
					subs.forEach((c) => {
						c._bits |= COMPONENT_FORCE;
						enqueueRender(c);
					});
				}
			};
			this.sub = (c) => {
				subs.add(c);
				let old = c.componentWillUnmount;
				c.componentWillUnmount = () => {
					subs.delete(c);
					if (old) old.call(c);
				};
			};
		}
		return props.children;
	}
	Context._id = "__cC" + i++;
	Context._defaultValue = defaultValue;
	Context.Consumer = (props, contextValue) => {
		return props.children(contextValue);
	};
	Context.Provider = Context.Consumer.contextType = Context;
	return Context;
}

// node_modules/preact/src/create-portal.js
function Portal(props) {
	return props.children;
}
function createPortal(vnode, container) {
	return createVNode(Portal, { _parentDom: container, children: vnode });
}

// node_modules/preact/hooks/src/index.js
var ObjectIs = Object.is;
var currentIndex;
var currentComponent;
var previousComponent;
var currentHook = 0;
var afterPaintEffects = [];
var unmountCleanups = [];
var options2 =
	/** @type {import('./internal').Options} */
	options_default;
var oldBeforeDiff = options2._diff;
var oldBeforeRender = options2._render;
var oldAfterDiff = options2.diffed;
var oldCommit = options2._commit;
var oldBeforeUnmount = options2.unmount;
var oldRoot = options2._root;
var RAF_TIMEOUT = 35;
var prevRaf;
options2._diff = (vnode) => {
	currentComponent = null;
	if (oldBeforeDiff) oldBeforeDiff(vnode);
};
options2._root = (vnode, parentDom) => {
	if (vnode && parentDom._children && parentDom._children._mask) {
		vnode._mask = parentDom._children._mask;
	}
	if (oldRoot) oldRoot(vnode, parentDom);
};
options2._render = (vnode) => {
	if (oldBeforeRender) oldBeforeRender(vnode);
	currentComponent = vnode._component;
	currentIndex = 0;
	const hooks = currentComponent.__hooks;
	if (hooks) {
		if (previousComponent == currentComponent) {
			currentComponent._renderCallbacks = [];
		} else {
			hooks._pendingEffects.some(invokeCleanup);
			hooks._pendingEffects.some(invokeEffect);
			currentIndex = 0;
		}
		hooks._pendingEffects = [];
		hooks._list.some((hookItem) => {
			if (hookItem._nextValue) {
				hookItem._value = hookItem._nextValue;
			}
			hookItem._pendingArgs = hookItem._nextValue = void 0;
		});
	}
	previousComponent = currentComponent;
};
options2.diffed = (vnode) => {
	if (oldAfterDiff) oldAfterDiff(vnode);
	const c = vnode._component;
	if (c && c.__hooks) {
		if (c.__hooks._pendingEffects.length) afterPaint(afterPaintEffects.push(c));
		c.__hooks._list.some((hookItem) => {
			if (hookItem._pendingArgs) hookItem._args = hookItem._pendingArgs;
		});
	}
	previousComponent = currentComponent = null;
};
options2._commit = (vnode, commitQueue) => {
	commitQueue.some((component) => {
		try {
			component._renderCallbacks.some(invokeCleanup);
			component._renderCallbacks = component._renderCallbacks.filter((cb) =>
				cb._value ? invokeEffect(cb) : true,
			);
		} catch (e) {
			commitQueue.some((c) => {
				if (c._renderCallbacks) c._renderCallbacks = [];
			});
			commitQueue = [];
			options2._catchError(e, component._vnode);
		}
	});
	if (oldCommit) oldCommit(vnode, commitQueue);
};
options2.unmount = (vnode) => {
	if (oldBeforeUnmount) oldBeforeUnmount(vnode);
	const c = vnode._component;
	if (c && c.__hooks) {
		let hasErrored, errorParent;
		c.__hooks._list.some((s) => {
			try {
				if (s._passive && s._cleanup) {
					if (errorParent === void 0) {
						errorParent = vnode._parent;
						while (
							errorParent &&
							!(errorParent._component && errorParent._component._parentDom)
						) {
							errorParent = errorParent._parent;
						}
						errorParent = errorParent && errorParent._component;
					}
					s._passive = errorParent;
					afterPaint(unmountCleanups.push(s));
				} else {
					invokeCleanup(s);
				}
			} catch (e) {
				hasErrored = e;
			}
		});
		c.__hooks = void 0;
		if (hasErrored) options2._catchError(hasErrored, c._vnode);
	}
};
function getHookState(index, type) {
	if (options2._hook) {
		options2._hook(currentComponent, index, currentHook || type);
	}
	currentHook = 0;
	const hooks =
		currentComponent.__hooks ||
		(currentComponent.__hooks = {
			_list: [],
			_pendingEffects: [],
		});
	if (index >= hooks._list.length) {
		hooks._list.push({});
	}
	return hooks._list[index];
}
function useState(initialState) {
	currentHook = 1;
	return useReducer(invokeOrReturn, initialState);
}
function useReducer(reducer, initialState, init) {
	const hookState = getHookState(currentIndex++, 2);
	hookState._reducer = reducer;
	if (!hookState._component) {
		hookState._value = [
			!init ? invokeOrReturn(void 0, initialState) : init(initialState),
			(action) => {
				const currentValue = hookState._nextValue
					? hookState._nextValue[0]
					: hookState._value[0];
				const nextValue = hookState._reducer(currentValue, action);
				if (!ObjectIs(currentValue, nextValue)) {
					hookState._nextValue = [nextValue, hookState._value[1]];
					hookState._component.setState({});
				}
			},
		];
		hookState._component = currentComponent;
		if (!currentComponent._hasScuFromHooks) {
			currentComponent._hasScuFromHooks = true;
			const prevScu = currentComponent.shouldComponentUpdate;
			currentComponent.shouldComponentUpdate = function (p, s, c) {
				const hooks = this.__hooks;
				if (!hooks) return true;
				let updatedHook = false;
				let shouldUpdate = this.props != p;
				hooks._list.some((hookItem) => {
					if (hookItem._nextValue) {
						updatedHook = true;
						if (!ObjectIs(hookItem._value[0], hookItem._nextValue[0])) {
							shouldUpdate = true;
						}
					}
				});
				if (prevScu) {
					const result2 = prevScu.call(this, p, s, c);
					return updatedHook ? result2 || shouldUpdate : result2;
				}
				return !updatedHook || shouldUpdate;
			};
		}
	}
	return hookState._value;
}
function useEffect(callback, args) {
	const state = getHookState(currentIndex++, 3);
	if (!options2._skipEffects && argsChanged(state._args, args)) {
		state._passive = true;
		state._value = callback;
		state._pendingArgs = args;
		currentComponent.__hooks._pendingEffects.push(state);
	}
}
function useLayoutEffect(callback, args) {
	const state = getHookState(currentIndex++, 4);
	if (!options2._skipEffects && argsChanged(state._args, args)) {
		state._passive = false;
		state._value = callback;
		state._pendingArgs = args;
		currentComponent._renderCallbacks.push(state);
	}
}
function useRef(initialValue) {
	currentHook = 5;
	return useMemo(() => ({ current: initialValue }), []);
}
function useImperativeHandle(ref, createHandle, args) {
	currentHook = 6;
	useLayoutEffect(
		() => {
			if (typeof ref == "function") {
				const result2 = ref(createHandle());
				return () => {
					ref(null);
					if (result2 && typeof result2 == "function") result2();
				};
			} else if (ref) {
				ref.current = createHandle();
				return () => (ref.current = null);
			}
		},
		args == null ? args : args.concat(ref),
	);
}
function useMemo(factory, args) {
	const state = getHookState(currentIndex++, 7);
	if (argsChanged(state._args, args)) {
		state._value = factory();
		state._args = args;
	}
	return state._value;
}
function useCallback(callback, args) {
	currentHook = 8;
	return useMemo(() => callback, args);
}
function useContext(context) {
	const provider = currentComponent.context[context._id];
	const state = getHookState(currentIndex++, 9);
	state._context = context;
	if (!provider) return context._defaultValue;
	if (state._value == null) {
		state._value = true;
		provider.sub(currentComponent);
	}
	return provider.props.value;
}
function useDebugValue(value, formatter) {
	if (options2.useDebugValue) {
		options2.useDebugValue(
			formatter
				? formatter(value)
				: /** @type {any}*/
					value,
		);
	}
}
function useId() {
	const state = getHookState(currentIndex++, 11);
	if (!state._value) {
		let root = currentComponent._vnode;
		while (!root._mask && root._parent) {
			root = root._parent;
		}
		let mask = root._mask || (root._mask = [0, 0]);
		state._value = "P" + mask[0] + "-" + mask[1]++;
	}
	return state._value;
}
function flushAfterPaintEffects() {
	let component;
	do {
		while ((component = unmountCleanups.shift())) {
			try {
				invokeCleanup(component);
			} catch (e) {
				component = /** @type {any} */ component._passive;
				options2._catchError(e, { _parent: component && component._vnode });
			}
		}
		while ((component = afterPaintEffects.shift())) {
			const hooks = component.__hooks;
			if (!component._parentDom || !hooks) continue;
			try {
				hooks._pendingEffects.some(invokeCleanup);
				hooks._pendingEffects.some(invokeEffect);
				hooks._pendingEffects = [];
			} catch (e) {
				hooks._pendingEffects = [];
				options2._catchError(e, component._vnode);
			}
		}
	} while (unmountCleanups.length);
}
var HAS_RAF = typeof requestAnimationFrame == "function";
function afterNextFrame(callback) {
	const done = () => {
		clearTimeout(timeout);
		if (HAS_RAF) cancelAnimationFrame(raf);
		setTimeout(callback);
	};
	const timeout = setTimeout(done, RAF_TIMEOUT);
	let raf;
	if (HAS_RAF) {
		raf = requestAnimationFrame(done);
	}
}
function afterPaint(newQueueLength) {
	if (newQueueLength == 1 || prevRaf != options2.requestAnimationFrame) {
		prevRaf = options2.requestAnimationFrame;
		(prevRaf || afterNextFrame)(flushAfterPaintEffects);
	}
}
function invokeCleanup(hook) {
	const comp = currentComponent;
	let cleanup = hook._cleanup;
	if (typeof cleanup == "function") {
		hook._cleanup = void 0;
		cleanup();
	}
	currentComponent = comp;
}
function invokeEffect(hook) {
	const comp = currentComponent;
	hook._cleanup = hook._value();
	currentComponent = comp;
}
function argsChanged(oldArgs, newArgs) {
	return (
		!oldArgs ||
		oldArgs.length != newArgs.length ||
		newArgs.some((arg, index) => !ObjectIs(arg, oldArgs[index]))
	);
}
function invokeOrReturn(arg, f) {
	return typeof f == "function" ? f(arg) : f;
}

// node_modules/preact/compat/src/Children.js
var mapFn = (children, fn, context) => {
	if (children == null) return null;
	return toChildArray(toChildArray(children).map(fn.bind(context)));
};
var Children = {
	map: mapFn,
	forEach: mapFn,
	count(children) {
		return children ? toChildArray(children).length : 0;
	},
	only(children) {
		const normalized = toChildArray(children);
		if (normalized.length != 1) throw "Children.only";
		return normalized[0];
	},
	toArray: toChildArray,
};

// node_modules/preact/compat/src/util.js
var assign2 = Object.assign;
function shallowDiffers(a, b) {
	for (let i3 in a) if (i3 != "__source" && a[i3] !== b[i3]) return true;
	for (let i3 in b) if (i3 != "__source" && !(i3 in a)) return true;
	return false;
}
var IS_NON_DIMENSIONAL =
	/^(-|f[lo].*[^se]$|g.{5,}[^ps]$|z|o[pr]|(W.{5})?[lL]i.*(t|mp)$|an|(bo|s).{4}Im|sca|m.{6}[ds]|ta|c.*[st]$|wido|ini)/;

// node_modules/preact/compat/src/PureComponent.js
function createPureComponent() {
	function PureComponent2(p, c) {
		this.props = p;
		this.context = c;
	}
	PureComponent2.prototype = new BaseComponent();
	PureComponent2.prototype.isPureReactComponent = true;
	PureComponent2.prototype.shouldComponentUpdate = function (props, state) {
		return (
			shallowDiffers(this.props, props) || shallowDiffers(this.state, state)
		);
	};
	return PureComponent2;
}
var PureComponent = /* @__PURE__ */ createPureComponent();

// node_modules/preact/compat/src/forwardRef.js
var REACT_FORWARD_SYMBOL = /* @__PURE__ */ Symbol.for("react.forward_ref");
function forwardRef(fn) {
	function Forwarded(props) {
		let clone = assign2({}, props);
		delete clone.ref;
		return fn(clone, props.ref || null);
	}
	Forwarded.$$typeof = REACT_FORWARD_SYMBOL;
	Forwarded.render = fn;
	Forwarded.prototype.isReactComponent = true;
	Forwarded.displayName = "ForwardRef(" + (fn.displayName || fn.name) + ")";
	return Forwarded;
}

// node_modules/preact/compat/src/hooks.js
function startTransition(cb) {
	cb();
}
function useDeferredValue(val) {
	return val;
}
function useTransition() {
	return [false, startTransition];
}
var useInsertionEffect = useLayoutEffect;
function useEffectEvent(callback) {
	const ref = useRef(callback);
	ref.current = callback;
	return (
		/** @type {T} */
		(
			function () {
				return ref.current.apply(void 0, arguments);
			}
		)
	);
}

// node_modules/preact/compat/src/memo.js
function memo(c, comparer) {
	function shouldUpdate(nextProps) {
		const ref = this.props.ref;
		if (ref != nextProps.ref && ref) {
			typeof ref == "function" ? ref(null) : (ref.current = null);
		}
		return comparer
			? !comparer(this.props, nextProps) || ref != nextProps.ref
			: shallowDiffers(this.props, nextProps);
	}
	function Memoed(props) {
		this.shouldComponentUpdate = shouldUpdate;
		return createElement(c, props);
	}
	Memoed.displayName = "Memo(" + (c.displayName || c.name) + ")";
	Memoed.prototype.isReactComponent = true;
	Memoed.type = c;
	return Memoed;
}

// node_modules/preact/compat/src/portals.js
function createPortal2(vnode, container) {
	const el = createPortal(vnode, container);
	el.containerInfo = container;
	return el;
}

// node_modules/preact/compat/src/render.js
var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.element");
var MODE_HYDRATE2 = 1 << 5;
var currentComponent2;
var hydrationRoot;
var renderTrackingInitialized;
var CAMEL_PROPS =
	/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(?!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
var CAMEL_REPLACE = /[A-Z0-9]/g;
var IS_DOM = typeof document < "u";
var useSyncExternalStore = /* @__PURE__ */ initRenderTracking(
	function useSyncExternalStore2(subscribe, getSnapshot, getServerSnapshot) {
		const serverRendering = options_default._skipEffects || hydrationRoot;
		const value = serverRendering
			? (getServerSnapshot || getSnapshot)()
			: getSnapshot();
		const [{ _instance }, forceUpdate] = useState({
			_instance: { _value: value, _getSnapshot: getSnapshot },
		});
		useLayoutEffect(() => {
			_instance._value = value;
			_instance._getSnapshot = getSnapshot;
			if (didSnapshotChange(_instance)) {
				forceUpdate({ _instance });
			}
		}, [subscribe, value, getSnapshot]);
		useEffect(() => {
			if (didSnapshotChange(_instance)) {
				forceUpdate({ _instance });
			}
			return subscribe(() => {
				if (didSnapshotChange(_instance)) {
					forceUpdate({ _instance });
				}
			});
		}, [subscribe]);
		return value;
	},
);
function didSnapshotChange(inst) {
	try {
		return !Object.is(inst._value, inst._getSnapshot());
	} catch (error) {
		return true;
	}
}
var onChangeInputType = (type) => /fil|che|rad/.test(type);
BaseComponent.prototype.isReactComponent = true;
[
	"componentWillMount",
	"componentWillReceiveProps",
	"componentWillUpdate",
].forEach((key) => {
	Object.defineProperty(BaseComponent.prototype, key, {
		configurable: true,
		get() {
			return this["UNSAFE_" + key];
		},
		set(v2) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value: v2,
			});
		},
	});
});
function render2(vnode, parent, callback) {
	if (parent._children == null) {
		parent.textContent = "";
	}
	render(vnode, parent);
	if (typeof callback == "function") callback();
	return vnode ? vnode._component : null;
}
function hydrate2(vnode, parent, callback) {
	hydrate(vnode, parent);
	if (typeof callback == "function") callback();
	return vnode ? vnode._component : null;
}
var oldEventHook = options_default.event;
options_default.event = (e) => {
	if (oldEventHook) e = oldEventHook(e);
	e.persist = () => {};
	e.isPropagationStopped = function isPropagationStopped() {
		return this.cancelBubble;
	};
	e.isDefaultPrevented = function isDefaultPrevented() {
		return this.defaultPrevented;
	};
	return (e.nativeEvent = e);
};
var classNameDescriptorNonEnumberable = {
	configurable: true,
	get() {
		return this.class;
	},
};
function handleDomVNode(vnode) {
	let props = vnode.props,
		type = vnode.type,
		normalizedProps = {},
		isNonDashedType = type.indexOf("-") == -1;
	for (let i3 in props) {
		let value = props[i3];
		if (
			(i3 == "value" && "defaultValue" in props && value == null) || // Emulate React's behavior of not rendering the contents of noscript tags on the client.
			(IS_DOM && i3 == "children" && type == "noscript") ||
			i3 == "class" ||
			i3 == "className"
		) {
			continue;
		}
		if (i3 == "style" && typeof value == "object") {
			let cloned;
			for (let key in value) {
				if (typeof value[key] == "number" && !IS_NON_DIMENSIONAL.test(key)) {
					if (!cloned) {
						cloned = value = assign2({}, value);
					}
					value[key] += "px";
				}
			}
		} else if (
			i3 == "defaultValue" &&
			"value" in props &&
			props.value == null
		) {
			i3 = "value";
		} else if (i3 == "download" && value === true) {
			value = "";
		} else if (i3 == "translate" && value === "no") {
			value = false;
		} else if (i3[0] == "o" && i3[1] == "n") {
			let lowerCased = i3.toLowerCase();
			if (lowerCased == "ondoubleclick") {
				i3 = "ondblclick";
			} else if (
				lowerCased == "onchange" &&
				(type == "input" || type == "textarea") &&
				!onChangeInputType(props.type)
			) {
				lowerCased = i3 = "oninput";
			} else if (lowerCased == "onfocus") {
				i3 = "onfocusin";
			} else if (lowerCased == "onblur") {
				i3 = "onfocusout";
			}
			if (lowerCased == "oninput") {
				i3 = lowerCased;
				if (normalizedProps[i3]) {
					i3 = "oninputCapture";
				}
			}
		} else if (isNonDashedType && CAMEL_PROPS.test(i3)) {
			i3 = i3.replace(CAMEL_REPLACE, "-$&").toLowerCase();
		} else if (value === null) {
			value = void 0;
		}
		normalizedProps[i3] = value;
	}
	if (type == "select") {
		if (normalizedProps.multiple && Array.isArray(normalizedProps.value)) {
			normalizedProps.value = toChildArray(props.children).forEach((child) => {
				child.props.selected =
					normalizedProps.value.indexOf(child.props.value) != -1;
			});
		}
		if (normalizedProps.defaultValue != null) {
			normalizedProps.value = toChildArray(props.children).forEach((child) => {
				if (normalizedProps.multiple) {
					child.props.selected =
						normalizedProps.defaultValue.indexOf(child.props.value) != -1;
				} else {
					child.props.selected =
						normalizedProps.defaultValue == child.props.value;
				}
			});
		}
	}
	if (props.class && !props.className) {
		normalizedProps.class = props.class;
		Object.defineProperty(
			normalizedProps,
			"className",
			classNameDescriptorNonEnumberable,
		);
	} else if (props.className) {
		normalizedProps.class = normalizedProps.className = props.className;
	}
	vnode.props = normalizedProps;
}
var oldVNodeHook = options_default.vnode;
options_default.vnode = (vnode) => {
	if (typeof vnode.type == "string") {
		handleDomVNode(vnode);
	} else if (typeof vnode.type == "function") {
		const shouldApplyRef =
			"prototype" in vnode.type && vnode.type.prototype.render;
		if ("ref" in vnode.props && shouldApplyRef) {
			vnode.ref = vnode.props.ref;
			delete vnode.props.ref;
		}
		if (vnode.type.defaultProps) {
			let normalizedProps = assign2({}, vnode.props);
			for (let i3 in vnode.type.defaultProps) {
				if (normalizedProps[i3] === void 0) {
					normalizedProps[i3] = vnode.type.defaultProps[i3];
				}
			}
			vnode.props = normalizedProps;
		}
	}
	if (vnode.ref && !("ref" in vnode.props)) {
		Object.defineProperty(vnode.props, "ref", {
			value: vnode.ref,
			configurable: true,
			writable: true,
		});
	}
	vnode.$$typeof = REACT_ELEMENT_TYPE;
	if (oldVNodeHook) oldVNodeHook(vnode);
};
function initRenderTracking(value) {
	if (!renderTrackingInitialized) {
		renderTrackingInitialized = true;
		const oldBeforeRender2 = options_default._render;
		options_default._render = (vnode) => {
			if (oldBeforeRender2) oldBeforeRender2(vnode);
			if (vnode._flags & MODE_HYDRATE2) hydrationRoot = vnode;
			currentComponent2 = vnode._component;
		};
		const oldDiffed = options_default.diffed;
		options_default.diffed = (vnode) => {
			if (oldDiffed) oldDiffed(vnode);
			currentComponent2 = null;
			if (hydrationRoot == vnode) hydrationRoot = null;
		};
	}
	return value;
}
var use = /* @__PURE__ */ initRenderTracking(function use2(resource) {
	if (resource.then) {
		if (resource.status == "fulfilled") return resource.value;
		if (resource.status == "rejected") throw resource.reason;
		if (!resource.status) {
			resource.status = "pending";
			resource.then(
				(value) => {
					resource.status = "fulfilled";
					resource.value = value;
				},
				(reason) => {
					resource.status = "rejected";
					resource.reason = reason;
				},
			);
		}
		throw resource;
	}
	const id = resource._id;
	const provider = currentComponent2._globalContext[id];
	if (!provider) return resource._defaultValue;
	if (!currentComponent2[id]) {
		currentComponent2[id] = true;
		provider.sub(currentComponent2);
	}
	return provider.props.value;
});
var __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	ReactCurrentDispatcher: {
		current: {
			readContext: use,
			useCallback,
			useContext,
			useDebugValue,
			useDeferredValue,
			useEffect,
			useId,
			useImperativeHandle,
			useInsertionEffect,
			useLayoutEffect,
			useMemo,
			// useMutableSource, // experimental-only and replaced by uSES, likely not worth supporting
			useReducer,
			useRef,
			useState,
			useSyncExternalStore,
			useTransition,
		},
	},
};

// node_modules/preact/compat/src/suspense.js
function initSuspenseHooks() {
	const oldCatchError = options_default._catchError;
	options_default._catchError = (error, newVNode, oldVNode, errorInfo) => {
		if (error.then) {
			let component;
			let vnode = newVNode;
			while ((vnode = vnode._parent)) {
				if ((component = vnode._component) && component._childDidSuspend) {
					if (oldVNode && !oldVNode._component)
						newVNode._component.__hooks = UNDEFINED;
					return component._childDidSuspend(error, newVNode);
				}
			}
		}
		oldCatchError(error, newVNode, oldVNode, errorInfo);
	};
	const oldUnmount = options_default.unmount;
	options_default.unmount = (vnode) => {
		const component = vnode._component;
		if (component && component._onResolve) {
			component._onResolve();
		}
		if (oldUnmount) oldUnmount(vnode);
	};
}
function detachedClone(vnode, detachedParent, parentDom) {
	if (vnode) {
		const hooks = vnode._component && vnode._component.__hooks;
		if (hooks) {
			hooks._list.forEach((effect) => {
				if (effect._passive != null) {
					if (typeof effect._cleanup == "function") effect._cleanup();
					effect._cleanup = effect._args = UNDEFINED;
				}
			});
			hooks._pendingEffects = vnode._component._renderCallbacks = [];
		}
		if (typeof vnode.type == "string") vnode._flags |= REF_DETACHED;
		vnode = assign2({ constructor: UNDEFINED }, vnode);
		if (vnode._component != null) {
			if (vnode._component._parentDom == parentDom) {
				vnode._component._parentDom = detachedParent;
			}
			vnode._component._bits |= COMPONENT_FORCE;
			vnode._component = vnode.ref = null;
		}
		vnode._children =
			vnode._children &&
			vnode._children.map((child) =>
				detachedClone(child, detachedParent, parentDom),
			);
	}
	return vnode;
}
function removeOriginal(vnode, detachedParent, originalParent) {
	if (vnode && originalParent) {
		if (typeof vnode.type == "string") {
			vnode._flags |= FORCE_PROPS_REVALIDATE;
		}
		vnode._original = null;
		vnode._children =
			vnode._children &&
			vnode._children.map((child) =>
				removeOriginal(child, detachedParent, originalParent),
			);
		if (vnode._component) {
			if (vnode._component._parentDom == detachedParent) {
				if (vnode._dom) {
					originalParent.appendChild(vnode._dom);
				}
				vnode._component._bits |= COMPONENT_FORCE;
				vnode._component._parentDom = originalParent;
			}
		}
	}
	return vnode;
}
function createSuspense() {
	initSuspenseHooks();
	function Suspense2() {
		this._pendingSuspensionCount = 0;
		this._suspenders = null;
		this._detachOnNextRender = null;
	}
	Suspense2.prototype = new BaseComponent();
	Suspense2.prototype._childDidSuspend = function (promise, suspendingVNode) {
		const suspendingComponent = suspendingVNode._component;
		if (this._suspenders == null) {
			this._suspenders = [];
		}
		this._suspenders.push(suspendingComponent);
		let resolved = false;
		const onResolved = () => {
			if (resolved || !this._parentDom) return;
			resolved = true;
			suspendingComponent._onResolve = null;
			onSuspensionComplete();
		};
		suspendingComponent._onResolve = onResolved;
		const originalParentDom = suspendingComponent._parentDom;
		suspendingComponent._parentDom = null;
		const onSuspensionComplete = () => {
			if (!--this._pendingSuspensionCount) {
				if (this.state._suspended) {
					const suspendedVNode = this.state._suspended;
					this._vnode._children[0] = removeOriginal(
						suspendedVNode,
						suspendedVNode._component._parentDom,
						suspendedVNode._component._originalParentDom,
					);
				}
				this.setState({ _suspended: (this._detachOnNextRender = null) });
				let suspended;
				while ((suspended = this._suspenders.pop())) {
					suspended._parentDom = originalParentDom;
					suspended.forceUpdate();
				}
			}
		};
		if (
			!this._pendingSuspensionCount++ &&
			!(suspendingVNode._flags & MODE_HYDRATE)
		) {
			this.setState({
				_suspended: (this._detachOnNextRender = this._vnode._children[0]),
			});
		}
		promise.then(onResolved, onResolved);
	};
	Suspense2.prototype.componentWillUnmount = function () {
		this._suspenders = [];
		if (this.state._suspended) this._vnode._children[0] = this.state._suspended;
	};
	Suspense2.prototype.render = function (props, state) {
		if (this._detachOnNextRender) {
			if (this._vnode._children) {
				const detachedParent = document.createElement("div");
				const detachedComponent = this._vnode._children[0]._component;
				this._vnode._children[0] = detachedClone(
					this._detachOnNextRender,
					detachedParent,
					(detachedComponent._originalParentDom = detachedComponent._parentDom),
				);
			}
			this._detachOnNextRender = null;
		}
		return [
			createElement(Fragment, null, state._suspended ? null : props.children),
			state._suspended && createElement(Fragment, null, props.fallback),
		];
	};
	return Suspense2;
}
var Suspense = /* @__PURE__ */ createSuspense();
function lazy(loader) {
	let prom;
	let component = null;
	let error;
	let resolved;
	function Lazy(props) {
		if (!prom) {
			prom = loader();
			prom.then(
				(exports) => {
					if (exports) {
						component = exports.default || exports;
					}
					resolved = true;
				},
				(e) => {
					error = e;
					resolved = true;
				},
			);
		}
		if (error) {
			throw error;
		}
		if (!resolved) {
			throw prom;
		}
		return component ? createElement(component, props) : null;
	}
	Lazy.displayName = "Lazy";
	return Lazy;
}

// node_modules/preact/compat/src/index.js
var version = "19.0.0";
function createFactory(type) {
	return createElement.bind(null, type);
}
function isValidElement2(element) {
	return !!element && element.$$typeof === REACT_ELEMENT_TYPE;
}
function isFragment(element) {
	return isValidElement2(element) && element.type == Fragment;
}
function isMemo(element) {
	return (
		!!element &&
		typeof element.displayName == "string" &&
		element.displayName.indexOf("Memo(") == 0
	);
}
function cloneElement2(element) {
	if (!isValidElement2(element)) return element;
	return cloneElement.apply(null, arguments);
}
function unmountComponentAtNode(container) {
	if (container._children) {
		render(null, container);
		return true;
	}
	return false;
}
function findDOMNode(component) {
	return (
		(component &&
			((component._vnode && component._vnode._dom) ||
				(component.nodeType == 1 && component))) ||
		null
	);
}
var flushSync = (callback, arg) => {
	const prevDebounce2 = options_default.debounceRendering;
	let flush;
	options_default.debounceRendering = (cb) => {
		flush = cb;
	};
	try {
		const res = callback(arg);
		if (flush) flush();
		return res;
	} finally {
		options_default.debounceRendering = prevDebounce2;
	}
};
function unstable_batchedUpdates(callback, arg) {
	return callback(arg);
}
var src_default = {
	useState,
	useId,
	useReducer,
	useEffect,
	useLayoutEffect,
	useInsertionEffect,
	useTransition,
	useDeferredValue,
	useSyncExternalStore,
	useEffectEvent,
	startTransition,
	useRef,
	useImperativeHandle,
	useMemo,
	useCallback,
	useContext,
	use,
	useDebugValue,
	version,
	Children,
	render: render2,
	hydrate: hydrate2,
	unmountComponentAtNode,
	createPortal: createPortal2,
	createElement,
	createContext,
	createFactory,
	cloneElement: cloneElement2,
	createRef,
	Fragment,
	isValidElement: isValidElement2,
	isElement: isValidElement2,
	isFragment,
	isMemo,
	findDOMNode,
	Component: BaseComponent,
	PureComponent,
	memo,
	forwardRef,
	flushSync,
	unstable_batchedUpdates,
	StrictMode: Fragment,
	Suspense,
	lazy,
	__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
};

// node_modules/convex/dist/esm/values/base64.js
var base64_exports = {};
__export(base64_exports, {
	byteLength: () => byteLength,
	fromByteArray: () => fromByteArray,
	fromByteArrayUrlSafeNoPadding: () => fromByteArrayUrlSafeNoPadding,
	toByteArray: () => toByteArray,
});
var lookup = [];
var revLookup = [];
var Arr = Uint8Array;
var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (i2 = 0, len = code.length; i2 < len; ++i2) {
	lookup[i2] = code[i2];
	revLookup[code.charCodeAt(i2)] = i2;
}
var i2;
var len;
revLookup["-".charCodeAt(0)] = 62;
revLookup["_".charCodeAt(0)] = 63;
function getLens(b64) {
	var len2 = b64.length;
	if (len2 % 4 > 0) {
		throw new Error("Invalid string. Length must be a multiple of 4");
	}
	var validLen = b64.indexOf("=");
	if (validLen === -1) validLen = len2;
	var placeHoldersLen = validLen === len2 ? 0 : 4 - (validLen % 4);
	return [validLen, placeHoldersLen];
}
function byteLength(b64) {
	var lens = getLens(b64);
	var validLen = lens[0];
	var placeHoldersLen = lens[1];
	return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
}
function _byteLength(_b64, validLen, placeHoldersLen) {
	return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
}
function toByteArray(b64) {
	var tmp;
	var lens = getLens(b64);
	var validLen = lens[0];
	var placeHoldersLen = lens[1];
	var arr2 = new Arr(_byteLength(b64, validLen, placeHoldersLen));
	var curByte = 0;
	var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
	var i3;
	for (i3 = 0; i3 < len2; i3 += 4) {
		tmp =
			(revLookup[b64.charCodeAt(i3)] << 18) |
			(revLookup[b64.charCodeAt(i3 + 1)] << 12) |
			(revLookup[b64.charCodeAt(i3 + 2)] << 6) |
			revLookup[b64.charCodeAt(i3 + 3)];
		arr2[curByte++] = (tmp >> 16) & 255;
		arr2[curByte++] = (tmp >> 8) & 255;
		arr2[curByte++] = tmp & 255;
	}
	if (placeHoldersLen === 2) {
		tmp =
			(revLookup[b64.charCodeAt(i3)] << 2) |
			(revLookup[b64.charCodeAt(i3 + 1)] >> 4);
		arr2[curByte++] = tmp & 255;
	}
	if (placeHoldersLen === 1) {
		tmp =
			(revLookup[b64.charCodeAt(i3)] << 10) |
			(revLookup[b64.charCodeAt(i3 + 1)] << 4) |
			(revLookup[b64.charCodeAt(i3 + 2)] >> 2);
		arr2[curByte++] = (tmp >> 8) & 255;
		arr2[curByte++] = tmp & 255;
	}
	return arr2;
}
function tripletToBase64(num) {
	return (
		lookup[(num >> 18) & 63] +
		lookup[(num >> 12) & 63] +
		lookup[(num >> 6) & 63] +
		lookup[num & 63]
	);
}
function encodeChunk(uint8, start, end) {
	var tmp;
	var output = [];
	for (var i3 = start; i3 < end; i3 += 3) {
		tmp =
			((uint8[i3] << 16) & 16711680) +
			((uint8[i3 + 1] << 8) & 65280) +
			(uint8[i3 + 2] & 255);
		output.push(tripletToBase64(tmp));
	}
	return output.join("");
}
function fromByteArray(uint8) {
	var tmp;
	var len2 = uint8.length;
	var extraBytes = len2 % 3;
	var parts = [];
	var maxChunkLength = 16383;
	for (
		var i3 = 0, len22 = len2 - extraBytes;
		i3 < len22;
		i3 += maxChunkLength
	) {
		parts.push(
			encodeChunk(
				uint8,
				i3,
				i3 + maxChunkLength > len22 ? len22 : i3 + maxChunkLength,
			),
		);
	}
	if (extraBytes === 1) {
		tmp = uint8[len2 - 1];
		parts.push(lookup[tmp >> 2] + lookup[(tmp << 4) & 63] + "==");
	} else if (extraBytes === 2) {
		tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
		parts.push(
			lookup[tmp >> 10] +
				lookup[(tmp >> 4) & 63] +
				lookup[(tmp << 2) & 63] +
				"=",
		);
	}
	return parts.join("");
}
function fromByteArrayUrlSafeNoPadding(uint8) {
	return fromByteArray(uint8)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

// node_modules/convex/dist/esm/common/index.js
function parseArgs(args) {
	if (args === void 0) {
		return {};
	}
	if (!isSimpleObject(args)) {
		throw new Error(
			`The arguments to a Convex function must be an object. Received: ${args}`,
		);
	}
	return args;
}
function validateDeploymentUrl(deploymentUrl) {
	if (typeof deploymentUrl === "undefined") {
		throw new Error(
			`Client created with undefined deployment address. If you used an environment variable, check that it's set.`,
		);
	}
	if (typeof deploymentUrl !== "string") {
		throw new Error(`Invalid deployment address: found ${deploymentUrl}".`);
	}
	if (!(
		deploymentUrl.startsWith("http:") || deploymentUrl.startsWith("https:")
	)) {
		throw new Error(
			`Invalid deployment address: Must start with "https://" or "http://". Found "${deploymentUrl}".`,
		);
	}
	try {
		new URL(deploymentUrl);
	} catch {
		throw new Error(
			`Invalid deployment address: "${deploymentUrl}" is not a valid URL. If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`,
		);
	}
	if (deploymentUrl.endsWith(".convex.site")) {
		throw new Error(
			`Invalid deployment address: "${deploymentUrl}" ends with .convex.site, which is used for HTTP Actions. Convex deployment URLs typically end with .convex.cloud? If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`,
		);
	}
}
function isSimpleObject(value) {
	const isObject = typeof value === "object";
	const prototype = Object.getPrototypeOf(value);
	const isSimple =
		prototype === null ||
		prototype === Object.prototype || // Objects generated from other contexts (e.g. across Node.js `vm` modules) will not satisfy the previous
		// conditions but are still simple objects.
		prototype?.constructor?.name === "Object";
	return isObject && isSimple;
}

// node_modules/convex/dist/esm/values/value.js
var LITTLE_ENDIAN = true;
var MIN_INT64 = BigInt("-9223372036854775808");
var MAX_INT64 = BigInt("9223372036854775807");
var ZERO = BigInt("0");
var EIGHT = BigInt("8");
var TWOFIFTYSIX = BigInt("256");
var COMMIT_TS_UNRESOLVED =
	"This commit timestamp is unresolved: its value is assigned when the mutation commits. Read the document after the mutation completes to get its value.";
var CommitTsPlaceholder = class {
	[Symbol.toPrimitive](hint) {
		if (hint === "string") {
			return this.toString();
		}
		throw new Error(COMMIT_TS_UNRESOLVED);
	}
	valueOf() {
		throw new Error(COMMIT_TS_UNRESOLVED);
	}
	toJSON() {
		throw new Error(COMMIT_TS_UNRESOLVED);
	}
	toString() {
		return "[unresolved commit timestamp]";
	}
};
var commitTsPlaceholder = new CommitTsPlaceholder();
function isSpecial(n) {
	return Number.isNaN(n) || !Number.isFinite(n) || Object.is(n, -0);
}
function slowBigIntToBase64(value) {
	if (value < ZERO) {
		value -= MIN_INT64 + MIN_INT64;
	}
	let hex = value.toString(16);
	if (hex.length % 2 === 1) hex = "0" + hex;
	const bytes = new Uint8Array(new ArrayBuffer(8));
	let i3 = 0;
	for (const hexByte of hex.match(/.{2}/g).reverse()) {
		bytes.set([parseInt(hexByte, 16)], i3++);
		value >>= EIGHT;
	}
	return fromByteArray(bytes);
}
function slowBase64ToBigInt(encoded) {
	const integerBytes = toByteArray(encoded);
	if (integerBytes.byteLength !== 8) {
		throw new Error(
			`Received ${integerBytes.byteLength} bytes, expected 8 for $integer`,
		);
	}
	let value = ZERO;
	let power = ZERO;
	for (const byte of integerBytes) {
		value += BigInt(byte) * TWOFIFTYSIX ** power;
		power++;
	}
	if (value > MAX_INT64) {
		value += MIN_INT64 + MIN_INT64;
	}
	return value;
}
function modernBigIntToBase64(value) {
	if (value < MIN_INT64 || MAX_INT64 < value) {
		throw new Error(
			`BigInt ${value} does not fit into a 64-bit signed integer.`,
		);
	}
	const buffer = new ArrayBuffer(8);
	new DataView(buffer).setBigInt64(0, value, true);
	return fromByteArray(new Uint8Array(buffer));
}
function modernBase64ToBigInt(encoded) {
	const integerBytes = toByteArray(encoded);
	if (integerBytes.byteLength !== 8) {
		throw new Error(
			`Received ${integerBytes.byteLength} bytes, expected 8 for $integer`,
		);
	}
	const intBytesView = new DataView(integerBytes.buffer);
	return intBytesView.getBigInt64(0, true);
}
var bigIntToBase64 = DataView.prototype.setBigInt64
	? modernBigIntToBase64
	: slowBigIntToBase64;
var base64ToBigInt = DataView.prototype.getBigInt64
	? modernBase64ToBigInt
	: slowBase64ToBigInt;
var MAX_IDENTIFIER_LEN = 1024;
function validateObjectField(k) {
	if (k.length > MAX_IDENTIFIER_LEN) {
		throw new Error(
			`Field name ${k} exceeds maximum field name length ${MAX_IDENTIFIER_LEN}.`,
		);
	}
	if (k.startsWith("$")) {
		throw new Error(`Field name ${k} starts with a '$', which is reserved.`);
	}
	for (let i3 = 0; i3 < k.length; i3 += 1) {
		const charCode = k.charCodeAt(i3);
		if (charCode < 32 || charCode >= 127) {
			throw new Error(
				`Field name ${k} has invalid character '${k[i3]}': Field names can only contain non-control ASCII characters`,
			);
		}
	}
}
function jsonToConvex(value) {
	if (value === null) {
		return value;
	}
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((value2) => jsonToConvex(value2));
	}
	if (typeof value !== "object") {
		throw new Error(`Unexpected type of ${value}`);
	}
	const entries = Object.entries(value);
	if (entries.length === 1) {
		const key = entries[0][0];
		if (key === "$bytes") {
			if (typeof value.$bytes !== "string") {
				throw new Error(`Malformed $bytes field on ${value}`);
			}
			return toByteArray(value.$bytes).buffer;
		}
		if (key === "$integer") {
			if (typeof value.$integer !== "string") {
				throw new Error(`Malformed $integer field on ${value}`);
			}
			return base64ToBigInt(value.$integer);
		}
		if (key === "$float") {
			if (typeof value.$float !== "string") {
				throw new Error(`Malformed $float field on ${value}`);
			}
			const floatBytes = toByteArray(value.$float);
			if (floatBytes.byteLength !== 8) {
				throw new Error(
					`Received ${floatBytes.byteLength} bytes, expected 8 for $float`,
				);
			}
			const floatBytesView = new DataView(floatBytes.buffer);
			const float = floatBytesView.getFloat64(0, LITTLE_ENDIAN);
			if (!isSpecial(float)) {
				throw new Error(`Float ${float} should be encoded as a number`);
			}
			return float;
		}
		if (key === "$commitTs") {
			if (value.$commitTs !== null) {
				throw new Error(`Malformed $commitTs field on ${value}`);
			}
			return commitTsPlaceholder;
		}
		if (key === "$set") {
			throw new Error(
				`Received a Set which is no longer supported as a Convex type.`,
			);
		}
		if (key === "$map") {
			throw new Error(
				`Received a Map which is no longer supported as a Convex type.`,
			);
		}
	}
	const out = {};
	for (const [k, v2] of Object.entries(value)) {
		validateObjectField(k);
		out[k] = jsonToConvex(v2);
	}
	return out;
}
var MAX_VALUE_FOR_ERROR_LEN = 16384;
function stringifyValueForError(value) {
	const str = JSON.stringify(value, (_key, value2) => {
		if (value2 === void 0) {
			return "undefined";
		}
		if (typeof value2 === "function") {
			return "[Function]";
		}
		if (typeof value2 === "symbol") {
			return String(value2);
		}
		if (typeof value2 === "bigint") {
			return `${value2.toString()}n`;
		}
		return value2;
	});
	if (str.length > MAX_VALUE_FOR_ERROR_LEN) {
		const rest = "[...truncated]";
		let truncateAt = MAX_VALUE_FOR_ERROR_LEN - rest.length;
		const codePoint = str.codePointAt(truncateAt - 1);
		if (codePoint !== void 0 && codePoint > 65535) {
			truncateAt -= 1;
		}
		return str.substring(0, truncateAt) + rest;
	}
	return str;
}
function convexToJsonInternal(
	value,
	originalValue,
	context,
	includeTopLevelUndefined,
) {
	if (value === void 0) {
		const contextText =
			context &&
			` (present at path ${context} in original object ${stringifyValueForError(
				originalValue,
			)})`;
		throw new Error(
			`undefined is not a valid Convex value${contextText}. To learn about Convex's supported types, see https://docs.convex.dev/using/types.`,
		);
	}
	if (value === null) {
		return value;
	}
	if (typeof value === "bigint") {
		if (value < MIN_INT64 || MAX_INT64 < value) {
			throw new Error(
				`BigInt ${value} does not fit into a 64-bit signed integer.`,
			);
		}
		return { $integer: bigIntToBase64(value) };
	}
	if (typeof value === "number") {
		if (isSpecial(value)) {
			const buffer = new ArrayBuffer(8);
			new DataView(buffer).setFloat64(0, value, LITTLE_ENDIAN);
			return { $float: fromByteArray(new Uint8Array(buffer)) };
		} else {
			return value;
		}
	}
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "string") {
		return value;
	}
	if (value instanceof ArrayBuffer) {
		return { $bytes: fromByteArray(new Uint8Array(value)) };
	}
	if (value instanceof CommitTsPlaceholder) {
		return { $commitTs: null };
	}
	if (Array.isArray(value)) {
		return value.map((value2, i3) =>
			convexToJsonInternal(value2, originalValue, context + `[${i3}]`, false),
		);
	}
	if (value instanceof Set) {
		throw new Error(
			errorMessageForUnsupportedType(context, "Set", [...value], originalValue),
		);
	}
	if (value instanceof Map) {
		throw new Error(
			errorMessageForUnsupportedType(context, "Map", [...value], originalValue),
		);
	}
	if (!isSimpleObject(value)) {
		const theType = value?.constructor?.name;
		const typeName = theType ? `${theType} ` : "";
		throw new Error(
			errorMessageForUnsupportedType(context, typeName, value, originalValue),
		);
	}
	const out = {};
	const entries = Object.entries(value);
	entries.sort(([k1, _v1], [k2, _v2]) => (k1 === k2 ? 0 : k1 < k2 ? -1 : 1));
	for (const [k, v2] of entries) {
		if (v2 !== void 0) {
			validateObjectField(k);
			out[k] = convexToJsonInternal(
				v2,
				originalValue,
				context + `.${k}`,
				false,
			);
		} else if (includeTopLevelUndefined) {
			validateObjectField(k);
			out[k] = convexOrUndefinedToJsonInternal(
				v2,
				originalValue,
				context + `.${k}`,
			);
		}
	}
	return out;
}
function errorMessageForUnsupportedType(
	context,
	typeName,
	value,
	originalValue,
) {
	if (context) {
		return `${typeName}${stringifyValueForError(
			value,
		)} is not a supported Convex type (present at path ${context} in original object ${stringifyValueForError(
			originalValue,
		)}). To learn about Convex's supported types, see https://docs.convex.dev/using/types.`;
	} else {
		return `${typeName}${stringifyValueForError(
			value,
		)} is not a supported Convex type.`;
	}
}
function convexOrUndefinedToJsonInternal(value, originalValue, context) {
	if (value === void 0) {
		return { $undefined: null };
	} else {
		if (originalValue === void 0) {
			throw new Error(
				`Programming error. Current value is ${stringifyValueForError(
					value,
				)} but original value is undefined`,
			);
		}
		return convexToJsonInternal(value, originalValue, context, false);
	}
}
function convexToJson(value) {
	return convexToJsonInternal(value, value, "", false);
}

// node_modules/convex/dist/esm/values/validators.js
var __defProp2 = Object.defineProperty;
var __defNormalProp = (obj, key, value) =>
	key in obj
		? __defProp2(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField = (obj, key, value) =>
	__defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var UNDEFINED_VALIDATOR_ERROR_URL =
	"https://docs.convex.dev/error#undefined-validator";
function throwUndefinedValidatorError(context, fieldName) {
	const fieldInfo = fieldName !== void 0 ? ` for field "${fieldName}"` : "";
	throw new Error(
		`A validator is undefined${fieldInfo} in ${context}. This is often caused by circular imports. See ${UNDEFINED_VALIDATOR_ERROR_URL} for details.`,
	);
}
var BaseValidator = class {
	constructor({ isOptional }) {
		__publicField(this, "type");
		__publicField(this, "fieldPaths");
		__publicField(this, "isOptional");
		__publicField(this, "isConvexValidator");
		this.isOptional = isOptional;
		this.isConvexValidator = true;
	}
};
var VId = class _VId extends BaseValidator {
	/**
	 * Usually you'd use `v.id(tableName)` instead.
	 */
	constructor({ isOptional, tableName }) {
		super({ isOptional });
		__publicField(this, "tableName");
		__publicField(this, "kind", "id");
		if (typeof tableName !== "string") {
			throw new Error("v.id(tableName) requires a string");
		}
		this.tableName = tableName;
	}
	/** @internal */
	get json() {
		return { type: "id", tableName: this.tableName };
	}
	/** Allow this field to be validated as absent. */
	optional() {
		return new _VId({
			isOptional: "optional",
			tableName: this.tableName,
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VFloat64 = class _VFloat64 extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "float64");
	}
	/** @internal */
	get json() {
		return { type: "number" };
	}
	/** Allow this field to be validated as absent. */
	optional() {
		return new _VFloat64({
			isOptional: "optional",
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VInt64 = class _VInt64 extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "int64");
	}
	/** @internal */
	get json() {
		return { type: "bigint" };
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VInt64({ isOptional: "optional" });
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VCommitTs = class _VCommitTs extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "commitTs");
	}
	/** @internal */
	get json() {
		return { type: this.kind };
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VCommitTs({
			isOptional: "optional",
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VBoolean = class _VBoolean extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "boolean");
	}
	/** @internal */
	get json() {
		return { type: this.kind };
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VBoolean({
			isOptional: "optional",
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VBytes = class _VBytes extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "bytes");
	}
	/** @internal */
	get json() {
		return { type: this.kind };
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VBytes({ isOptional: "optional" });
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VString = class _VString extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "string");
	}
	/** @internal */
	get json() {
		return { type: this.kind };
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VString({
			isOptional: "optional",
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VNull = class _VNull extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "null");
	}
	/** @internal */
	get json() {
		return { type: this.kind };
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VNull({ isOptional: "optional" });
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VAny = class _VAny extends BaseValidator {
	constructor() {
		super(...arguments);
		__publicField(this, "kind", "any");
	}
	/** @internal */
	get json() {
		return {
			type: this.kind,
		};
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VAny({
			isOptional: "optional",
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VObject = class _VObject extends BaseValidator {
	/**
	 * Usually you'd use `v.object({ ... })` instead.
	 */
	constructor({ isOptional, fields }) {
		super({ isOptional });
		__publicField(this, "fields");
		__publicField(this, "kind", "object");
		globalThis.Object.entries(fields).forEach(([fieldName, validator]) => {
			if (validator === void 0) {
				throwUndefinedValidatorError("v.object()", fieldName);
			}
			if (!validator.isConvexValidator) {
				throw new Error("v.object() entries must be validators");
			}
		});
		this.fields = fields;
	}
	/** @internal */
	get json() {
		return {
			type: this.kind,
			value: globalThis.Object.fromEntries(
				globalThis.Object.entries(this.fields).map(([k, v2]) => [
					k,
					{
						fieldType: v2.json,
						optional: v2.isOptional === "optional" ? true : false,
					},
				]),
			),
		};
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VObject({
			isOptional: "optional",
			fields: this.fields,
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
	/**
	 * Create a new VObject with the specified fields omitted.
	 * @param fields The field names to omit from this VObject.
	 */
	omit(...fields) {
		const newFields = { ...this.fields };
		for (const field of fields) {
			delete newFields[field];
		}
		return new _VObject({
			isOptional: this.isOptional,
			fields: newFields,
		});
	}
	/**
	 * Create a new VObject with only the specified fields.
	 * @param fields The field names to pick from this VObject.
	 */
	pick(...fields) {
		const newFields = {};
		for (const field of fields) {
			newFields[field] = this.fields[field];
		}
		return new _VObject({
			isOptional: this.isOptional,
			fields: newFields,
		});
	}
	/**
	 * Create a new VObject with all fields marked as optional.
	 */
	partial() {
		const newFields = {};
		for (const [key, validator] of globalThis.Object.entries(this.fields)) {
			newFields[key] = validator.asOptional();
		}
		return new _VObject({
			isOptional: this.isOptional,
			fields: newFields,
		});
	}
	/**
	 * Create a new VObject with additional fields merged in.
	 * @param fields An object with additional validators to merge into this VObject.
	 */
	extend(fields) {
		return new _VObject({
			isOptional: this.isOptional,
			fields: { ...this.fields, ...fields },
		});
	}
};
var VLiteral = class _VLiteral extends BaseValidator {
	/**
	 * Usually you'd use `v.literal(value)` instead.
	 */
	constructor({ isOptional, value }) {
		super({ isOptional });
		__publicField(this, "value");
		__publicField(this, "kind", "literal");
		if (
			typeof value !== "string" &&
			typeof value !== "boolean" &&
			typeof value !== "number" &&
			typeof value !== "bigint"
		) {
			throw new Error("v.literal(value) must be a string, number, or boolean");
		}
		this.value = value;
	}
	/** @internal */
	get json() {
		return {
			type: this.kind,
			value: convexToJson(this.value),
		};
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VLiteral({
			isOptional: "optional",
			value: this.value,
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VArray = class _VArray extends BaseValidator {
	/**
	 * Usually you'd use `v.array(element)` instead.
	 */
	constructor({ isOptional, element }) {
		super({ isOptional });
		__publicField(this, "element");
		__publicField(this, "kind", "array");
		if (element === void 0) {
			throwUndefinedValidatorError("v.array()");
		}
		this.element = element;
	}
	/** @internal */
	get json() {
		return {
			type: this.kind,
			value: this.element.json,
		};
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VArray({
			isOptional: "optional",
			element: this.element,
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VRecord = class _VRecord extends BaseValidator {
	/**
	 * Usually you'd use `v.record(key, value)` instead.
	 */
	constructor({ isOptional, key, value }) {
		super({ isOptional });
		__publicField(this, "key");
		__publicField(this, "value");
		__publicField(this, "kind", "record");
		if (key === void 0) {
			throwUndefinedValidatorError("v.record()", "key");
		}
		if (value === void 0) {
			throwUndefinedValidatorError("v.record()", "value");
		}
		if (key.isOptional === "optional") {
			throw new Error("Record validator cannot have optional keys");
		}
		if (value.isOptional === "optional") {
			throw new Error("Record validator cannot have optional values");
		}
		if (!key.isConvexValidator || !value.isConvexValidator) {
			throw new Error("Key and value of v.record() must be validators");
		}
		this.key = key;
		this.value = value;
	}
	/** @internal */
	get json() {
		return {
			type: this.kind,
			// This cast is needed because TypeScript thinks the key type is too wide
			keys: this.key.json,
			values: {
				fieldType: this.value.json,
				optional: false,
			},
		};
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VRecord({
			isOptional: "optional",
			key: this.key,
			value: this.value,
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};
var VUnion = class _VUnion extends BaseValidator {
	/**
	 * Usually you'd use `v.union(...members)` instead.
	 */
	constructor({ isOptional, members }) {
		super({ isOptional });
		__publicField(this, "members");
		__publicField(this, "kind", "union");
		members.forEach((member, index) => {
			if (member === void 0) {
				throwUndefinedValidatorError("v.union()", `member at index ${index}`);
			}
			if (!member.isConvexValidator) {
				throw new Error("All members of v.union() must be validators");
			}
		});
		this.members = members;
	}
	/** @internal */
	get json() {
		return {
			type: this.kind,
			value: this.members.map((v2) => v2.json),
		};
	}
	/** Allow this validated field to be absent. */
	optional() {
		return new _VUnion({
			isOptional: "optional",
			members: this.members,
		});
	}
	/** @internal */
	asOptional() {
		return this.optional();
	}
};

// node_modules/convex/dist/esm/values/validator.js
function isValidator(v2) {
	return v2?.isConvexValidator === true;
}
var v = {
	/**
	 * Validates that the value is a document ID for the given table.
	 *
	 * IDs are strings at runtime but are typed as `Id<"tableName">` in
	 * TypeScript for type safety.
	 *
	 * @example
	 * ```typescript
	 * args: { userId: v.id("users") }
	 * ```
	 *
	 * @param tableName The name of the table.
	 */
	id: (tableName) => {
		return new VId({
			isOptional: "required",
			tableName,
		});
	},
	/**
	 * Validates that the value is `null`.
	 *
	 * Use `returns: v.null()` for functions that don't return a meaningful value.
	 * JavaScript `undefined` is not a valid Convex value, it is automatically
	 * converted to `null`.
	 */
	null: () => {
		return new VNull({ isOptional: "required" });
	},
	/**
	 * Validates that the value is a JavaScript `number` (Convex Float64).
	 *
	 * Supports all IEEE-754 double-precision floating point numbers including
	 * NaN and Infinity.
	 *
	 * Alias for `v.float64()`.
	 */
	number: () => {
		return new VFloat64({ isOptional: "required" });
	},
	/**
	 * Validates that the value is a JavaScript `number` (Convex Float64).
	 *
	 * Supports all IEEE-754 double-precision floating point numbers.
	 */
	float64: () => {
		return new VFloat64({ isOptional: "required" });
	},
	/**
	 * @deprecated Use `v.int64()` instead.
	 */
	bigint: () => {
		return new VInt64({ isOptional: "required" });
	},
	/**
	 * Validates that the value is a JavaScript `bigint` (Convex Int64).
	 *
	 * Supports BigInts between -2^63 and 2^63-1.
	 *
	 * @example
	 * ```typescript
	 * args: { timestamp: v.int64() }
	 * // Usage: createDoc({ timestamp: 1234567890n })
	 * ```
	 */
	int64: () => {
		return new VInt64({ isOptional: "required" });
	},
	/**
	 * Validates that the value is a commit timestamp: an int64 (`bigint`)
	 * assigned from the transaction's commit timestamp.
	 *
	 * An index on a field with this validator orders documents by commit order.
	 * Accepts any int64 value; write `db.vars.commitTs` to have the field
	 * resolve to the commit timestamp when the mutation commits.
	 */
	commitTs: () => {
		return new VCommitTs({ isOptional: "required" });
	},
	/**
	 * Validates that the value is a `boolean`.
	 */
	boolean: () => {
		return new VBoolean({ isOptional: "required" });
	},
	/**
	 * Validates that the value is a `string`.
	 *
	 * Strings are stored as UTF-8 and their storage size is calculated as their
	 * UTF-8 encoded size.
	 */
	string: () => {
		return new VString({ isOptional: "required" });
	},
	/**
	 * Validates that the value is an `ArrayBuffer` (Convex Bytes).
	 *
	 * Use for binary data.
	 */
	bytes: () => {
		return new VBytes({ isOptional: "required" });
	},
	/**
	 * Validates that the value is exactly equal to the given literal.
	 *
	 * Useful for discriminated unions and enum-like patterns.
	 *
	 * @example
	 * ```typescript
	 * // Discriminated union pattern:
	 * v.union(
	 *   v.object({ kind: v.literal("error"), message: v.string() }),
	 *   v.object({ kind: v.literal("success"), value: v.number() }),
	 * )
	 * ```
	 *
	 * @param literal The literal value to compare against.
	 */
	literal: (literal) => {
		return new VLiteral({ isOptional: "required", value: literal });
	},
	/**
	 * Validates that the value is an `Array` where every element matches the
	 * given validator.
	 *
	 * Arrays can have at most 8192 elements.
	 *
	 * @example
	 * ```typescript
	 * args: { tags: v.array(v.string()) }
	 * args: { coordinates: v.array(v.number()) }
	 * args: { items: v.array(v.object({ name: v.string(), qty: v.number() })) }
	 * ```
	 *
	 * @param element The validator for the elements of the array.
	 */
	array: (element) => {
		return new VArray({ isOptional: "required", element });
	},
	/**
	 * Validates that the value is an `Object` with the specified properties.
	 *
	 * Objects can have at most 1024 entries. Field names must be non-empty and
	 * must not start with `"$"` or `"_"` (`_` is reserved for system fields
	 * like `_id` and `_creationTime`; `$` is reserved for Convex internal use).
	 *
	 * @example
	 * ```typescript
	 * args: {
	 *   user: v.object({
	 *     name: v.string(),
	 *     email: v.string(),
	 *     age: v.optional(v.number()),
	 *   })
	 * }
	 * ```
	 *
	 * @param fields An object mapping property names to their validators.
	 */
	object: (fields) => {
		return new VObject({ isOptional: "required", fields });
	},
	/**
	 * Validates that the value is a `Record` (object with dynamic keys).
	 *
	 * Records are objects at runtime but allow dynamic keys, unlike `v.object()`
	 * which requires known property names. Keys must be ASCII characters only,
	 * non-empty, and not start with `"$"` or `"_"`.
	 *
	 * @example
	 * ```typescript
	 * // Map of user IDs to scores:
	 * args: { scores: v.record(v.id("users"), v.number()) }
	 *
	 * // Map of string keys to string values:
	 * args: { metadata: v.record(v.string(), v.string()) }
	 * ```
	 *
	 * @param keys The validator for the keys of the record.
	 * @param values The validator for the values of the record.
	 */
	record: (keys, values) => {
		return new VRecord({
			isOptional: "required",
			key: keys,
			value: values,
		});
	},
	/**
	 * Validates that the value matches at least one of the given validators.
	 *
	 * @example
	 * ```typescript
	 * // Allow string or number:
	 * args: { value: v.union(v.string(), v.number()) }
	 *
	 * // Discriminated union (recommended pattern):
	 * v.union(
	 *   v.object({ kind: v.literal("text"), body: v.string() }),
	 *   v.object({ kind: v.literal("image"), url: v.string() }),
	 * )
	 *
	 * // Nullable value:
	 * returns: v.union(v.object({ ... }), v.null())
	 * ```
	 *
	 * @param members The validators to match against.
	 */
	union: (...members) => {
		return new VUnion({
			isOptional: "required",
			members,
		});
	},
	/**
	 * A validator that accepts any Convex value without validation.
	 *
	 * Prefer using specific validators when possible for better type safety
	 * and runtime validation.
	 */
	any: () => {
		return new VAny({ isOptional: "required" });
	},
	/**
	 * Makes a property optional in an object validator.
	 *
	 * An optional property can be omitted entirely when creating a document or
	 * calling a function. This is different from `v.nullable()` which requires
	 * the property to be present but allows `null`.
	 *
	 * @example
	 * ```typescript
	 * v.object({
	 *   name: v.string(),              // required
	 *   nickname: v.optional(v.string()), // can be omitted
	 * })
	 *
	 * // Valid: { name: "Alice" }
	 * // Valid: { name: "Alice", nickname: "Ali" }
	 * // Invalid: { name: "Alice", nickname: null }  - use v.nullable() for this
	 * ```
	 *
	 * @param value The property value validator to make optional.
	 */
	optional: (value) => {
		return value.asOptional();
	},
	/**
	 * Allows a value to be either the given type or `null`.
	 *
	 * This is shorthand for `v.union(value, v.null())`. Unlike `v.optional()`,
	 * the property must still be present, but may be `null`.
	 *
	 * @example
	 * ```typescript
	 * v.object({
	 *   name: v.string(),
	 *   deletedAt: v.nullable(v.number()), // must be present, can be null
	 * })
	 *
	 * // Valid: { name: "Alice", deletedAt: null }
	 * // Valid: { name: "Alice", deletedAt: 1234567890 }
	 * // Invalid: { name: "Alice" }  - deletedAt is required
	 * ```
	 */
	nullable: (value) => {
		return v.union(value, v.null());
	},
};

// node_modules/convex/dist/esm/values/errors.js
var __defProp3 = Object.defineProperty;
var __defNormalProp2 = (obj, key, value) =>
	key in obj
		? __defProp3(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField2 = (obj, key, value) =>
	__defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
var _a;
var _b;
var IDENTIFYING_FIELD = /* @__PURE__ */ Symbol.for("ConvexError");
var ConvexError = class extends ((_b = Error), (_a = IDENTIFYING_FIELD), _b) {
	constructor(data) {
		super(typeof data === "string" ? data : stringifyValueForError(data));
		__publicField2(this, "name", "ConvexError");
		__publicField2(this, "data");
		__publicField2(this, _a, true);
		this.data = data;
	}
};

// node_modules/convex/dist/esm/values/compare_utf8.js
var arr = () => Array.from({ length: 4 }, () => 0);
var aBytes = arr();
var bBytes = arr();

// node_modules/convex/dist/esm/index.js
var version2 = "1.47.0";

// node_modules/convex/dist/esm/browser/logging.js
var __defProp4 = Object.defineProperty;
var __defNormalProp3 = (obj, key, value) =>
	key in obj
		? __defProp4(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField3 = (obj, key, value) =>
	__defNormalProp3(obj, typeof key !== "symbol" ? key + "" : key, value);
var INFO_COLOR = "color:rgb(0, 145, 255)";
function prefix_for_source(source) {
	switch (source) {
		case "query":
			return "Q";
		case "mutation":
			return "M";
		case "action":
			return "A";
		case "any":
			return "?";
	}
}
var DefaultLogger = class {
	constructor(options3) {
		__publicField3(this, "_onLogLineFuncs");
		__publicField3(this, "_verbose");
		this._onLogLineFuncs = {};
		this._verbose = options3.verbose;
	}
	addLogLineListener(func) {
		let id = Math.random().toString(36).substring(2, 15);
		for (let i3 = 0; i3 < 10; i3++) {
			if (this._onLogLineFuncs[id] === void 0) {
				break;
			}
			id = Math.random().toString(36).substring(2, 15);
		}
		this._onLogLineFuncs[id] = func;
		return () => {
			delete this._onLogLineFuncs[id];
		};
	}
	logVerbose(...args) {
		if (this._verbose) {
			for (const func of Object.values(this._onLogLineFuncs)) {
				func("debug", `${/* @__PURE__ */ new Date().toISOString()}`, ...args);
			}
		}
	}
	log(...args) {
		for (const func of Object.values(this._onLogLineFuncs)) {
			func("info", ...args);
		}
	}
	warn(...args) {
		for (const func of Object.values(this._onLogLineFuncs)) {
			func("warn", ...args);
		}
	}
	error(...args) {
		for (const func of Object.values(this._onLogLineFuncs)) {
			func("error", ...args);
		}
	}
};
function instantiateDefaultLogger(options3) {
	const logger = new DefaultLogger(options3);
	logger.addLogLineListener((level, ...args) => {
		switch (level) {
			case "debug":
				console.debug(...args);
				break;
			case "info":
				console.log(...args);
				break;
			case "warn":
				console.warn(...args);
				break;
			case "error":
				console.error(...args);
				break;
			default: {
				level;
				console.log(...args);
			}
		}
	});
	return logger;
}
function instantiateNoopLogger(options3) {
	return new DefaultLogger(options3);
}
function logForFunction(logger, type, source, udfPath, message) {
	const prefix = prefix_for_source(source);
	if (typeof message === "object") {
		message = `ConvexError ${JSON.stringify(message.errorData, null, 2)}`;
	}
	if (type === "info") {
		const match = message.match(/^\[.*?\] /);
		if (match === null) {
			logger.error(
				`[CONVEX ${prefix}(${udfPath})] Could not parse console.log`,
			);
			return;
		}
		const level = message.slice(1, match[0].length - 2);
		const args = message.slice(match[0].length);
		logger.log(`%c[CONVEX ${prefix}(${udfPath})] [${level}]`, INFO_COLOR, args);
	} else {
		logger.error(`[CONVEX ${prefix}(${udfPath})] ${message}`);
	}
}
function logFatalError(logger, message) {
	const errorMessage = `[CONVEX FATAL ERROR] ${message}`;
	logger.error(errorMessage);
	return new Error(errorMessage);
}
function createHybridErrorStacktrace(source, udfPath, result2) {
	const prefix = prefix_for_source(source);
	return `[CONVEX ${prefix}(${udfPath})] ${result2.errorMessage}
  Called by client`;
}
function forwardData(result2, error) {
	error.data = result2.errorData;
	return error;
}

// node_modules/convex/dist/esm/browser/sync/udf_path_utils.js
function canonicalizeUdfPath(udfPath) {
	const pieces = udfPath.split(":");
	let moduleName;
	let functionName2;
	if (pieces.length === 1) {
		moduleName = pieces[0];
		functionName2 = "default";
	} else {
		moduleName = pieces.slice(0, pieces.length - 1).join(":");
		functionName2 = pieces[pieces.length - 1];
	}
	if (moduleName.endsWith(".js")) {
		moduleName = moduleName.slice(0, -3);
	}
	return `${moduleName}:${functionName2}`;
}
function serializePathAndArgs(udfPath, args) {
	return JSON.stringify({
		udfPath: canonicalizeUdfPath(udfPath),
		args: convexToJson(args),
	});
}
function serializePaginatedPathAndArgs(udfPath, args, options3) {
	const { initialNumItems, id } = options3;
	const result2 = JSON.stringify({
		type: "paginated",
		udfPath: canonicalizeUdfPath(udfPath),
		args: convexToJson(args),
		options: convexToJson({ initialNumItems, id }),
	});
	return result2;
}

// node_modules/convex/dist/esm/browser/sync/local_state.js
var __defProp5 = Object.defineProperty;
var __defNormalProp4 = (obj, key, value) =>
	key in obj
		? __defProp5(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField4 = (obj, key, value) =>
	__defNormalProp4(obj, typeof key !== "symbol" ? key + "" : key, value);
var LocalSyncState = class {
	constructor() {
		__publicField4(this, "nextQueryId");
		__publicField4(this, "querySetVersion");
		__publicField4(this, "querySet");
		__publicField4(this, "queryIdToToken");
		__publicField4(this, "identityVersion");
		__publicField4(this, "auth");
		__publicField4(this, "outstandingQueriesOlderThanRestart");
		__publicField4(this, "outstandingAuthOlderThanRestart");
		__publicField4(this, "paused");
		__publicField4(this, "pendingQuerySetModifications");
		this.nextQueryId = 0;
		this.querySetVersion = 0;
		this.identityVersion = 0;
		this.querySet = /* @__PURE__ */ new Map();
		this.queryIdToToken = /* @__PURE__ */ new Map();
		this.outstandingQueriesOlderThanRestart = /* @__PURE__ */ new Set();
		this.outstandingAuthOlderThanRestart = false;
		this.paused = false;
		this.pendingQuerySetModifications = /* @__PURE__ */ new Map();
	}
	hasSyncedPastLastReconnect() {
		return (
			this.outstandingQueriesOlderThanRestart.size === 0 &&
			!this.outstandingAuthOlderThanRestart
		);
	}
	markAuthCompletion() {
		this.outstandingAuthOlderThanRestart = false;
	}
	subscribe(udfPath, args, journal, componentPath) {
		const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
		const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
		const existingEntry = this.querySet.get(queryToken);
		if (existingEntry !== void 0) {
			existingEntry.numSubscribers += 1;
			return {
				queryToken,
				modification: null,
				unsubscribe: () => this.removeSubscriber(queryToken),
			};
		} else {
			const queryId = this.nextQueryId++;
			const query = {
				id: queryId,
				canonicalizedUdfPath,
				args,
				numSubscribers: 1,
				journal,
				componentPath,
			};
			this.querySet.set(queryToken, query);
			this.queryIdToToken.set(queryId, queryToken);
			const baseVersion = this.querySetVersion;
			const newVersion = this.querySetVersion + 1;
			const add = {
				type: "Add",
				queryId,
				udfPath: canonicalizedUdfPath,
				args: [convexToJson(args)],
				journal,
				componentPath,
			};
			if (this.paused) {
				this.pendingQuerySetModifications.set(queryId, add);
			} else {
				this.querySetVersion = newVersion;
			}
			const modification = {
				type: "ModifyQuerySet",
				baseVersion,
				newVersion,
				modifications: [add],
			};
			return {
				queryToken,
				modification,
				unsubscribe: () => this.removeSubscriber(queryToken),
			};
		}
	}
	transition(transition) {
		for (const modification of transition.modifications) {
			switch (modification.type) {
				case "QueryUpdated":
				case "QueryFailed": {
					this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
					const journal = modification.journal;
					if (journal !== void 0) {
						const queryToken = this.queryIdToToken.get(modification.queryId);
						if (queryToken !== void 0) {
							this.querySet.get(queryToken).journal = journal;
						}
					}
					break;
				}
				case "QueryRemoved": {
					this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
					break;
				}
				default: {
					modification;
					throw new Error(`Invalid modification ${modification.type}`);
				}
			}
		}
	}
	queryId(udfPath, args) {
		const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
		const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
		const existingEntry = this.querySet.get(queryToken);
		if (existingEntry !== void 0) {
			return existingEntry.id;
		}
		return null;
	}
	isCurrentOrNewerAuthVersion(version3) {
		return version3 >= this.identityVersion;
	}
	getAuth() {
		return this.auth;
	}
	setAuth(value) {
		this.auth = {
			tokenType: "User",
			value,
		};
		const baseVersion = this.identityVersion;
		if (!this.paused) {
			this.identityVersion = baseVersion + 1;
		}
		return {
			type: "Authenticate",
			baseVersion,
			...this.auth,
		};
	}
	setAdminAuth(value, actingAs) {
		const auth = {
			tokenType: "Admin",
			value,
			impersonating: actingAs,
		};
		this.auth = auth;
		const baseVersion = this.identityVersion;
		if (!this.paused) {
			this.identityVersion = baseVersion + 1;
		}
		return {
			type: "Authenticate",
			baseVersion,
			...auth,
		};
	}
	clearAuth() {
		this.auth = void 0;
		this.markAuthCompletion();
		const baseVersion = this.identityVersion;
		if (!this.paused) {
			this.identityVersion = baseVersion + 1;
		}
		return {
			type: "Authenticate",
			tokenType: "None",
			baseVersion,
		};
	}
	hasAuth() {
		return !!this.auth;
	}
	isNewAuth(value) {
		return this.auth?.value !== value;
	}
	queryPath(queryId) {
		const pathAndArgs = this.queryIdToToken.get(queryId);
		if (pathAndArgs) {
			return this.querySet.get(pathAndArgs).canonicalizedUdfPath;
		}
		return null;
	}
	queryArgs(queryId) {
		const pathAndArgs = this.queryIdToToken.get(queryId);
		if (pathAndArgs) {
			return this.querySet.get(pathAndArgs).args;
		}
		return null;
	}
	queryToken(queryId) {
		return this.queryIdToToken.get(queryId) ?? null;
	}
	queryJournal(queryToken) {
		return this.querySet.get(queryToken)?.journal;
	}
	restart() {
		this.unpause();
		this.outstandingQueriesOlderThanRestart.clear();
		const modifications = [];
		for (const localQuery of this.querySet.values()) {
			const add = {
				type: "Add",
				queryId: localQuery.id,
				udfPath: localQuery.canonicalizedUdfPath,
				args: [convexToJson(localQuery.args)],
				journal: localQuery.journal,
				componentPath: localQuery.componentPath,
			};
			modifications.push(add);
			this.outstandingQueriesOlderThanRestart.add(localQuery.id);
		}
		this.querySetVersion = 1;
		const querySet = {
			type: "ModifyQuerySet",
			baseVersion: 0,
			newVersion: 1,
			modifications,
		};
		if (!this.auth) {
			this.identityVersion = 0;
			return [querySet, void 0];
		}
		this.outstandingAuthOlderThanRestart = true;
		const authenticate = {
			type: "Authenticate",
			baseVersion: 0,
			...this.auth,
		};
		this.identityVersion = 1;
		return [querySet, authenticate];
	}
	pause() {
		this.paused = true;
	}
	resume() {
		const querySet =
			this.pendingQuerySetModifications.size > 0
				? {
						type: "ModifyQuerySet",
						baseVersion: this.querySetVersion,
						newVersion: ++this.querySetVersion,
						modifications: Array.from(
							this.pendingQuerySetModifications.values(),
						),
					}
				: void 0;
		const authenticate =
			this.auth !== void 0
				? {
						type: "Authenticate",
						baseVersion: this.identityVersion++,
						...this.auth,
					}
				: void 0;
		this.unpause();
		return [querySet, authenticate];
	}
	unpause() {
		this.paused = false;
		this.pendingQuerySetModifications.clear();
	}
	removeSubscriber(queryToken) {
		const localQuery = this.querySet.get(queryToken);
		if (localQuery.numSubscribers > 1) {
			localQuery.numSubscribers -= 1;
			return null;
		} else {
			this.querySet.delete(queryToken);
			this.queryIdToToken.delete(localQuery.id);
			this.outstandingQueriesOlderThanRestart.delete(localQuery.id);
			const baseVersion = this.querySetVersion;
			const newVersion = this.querySetVersion + 1;
			const remove = {
				type: "Remove",
				queryId: localQuery.id,
			};
			if (this.paused) {
				if (this.pendingQuerySetModifications.has(localQuery.id)) {
					this.pendingQuerySetModifications.delete(localQuery.id);
				} else {
					this.pendingQuerySetModifications.set(localQuery.id, remove);
				}
			} else {
				this.querySetVersion = newVersion;
			}
			return {
				type: "ModifyQuerySet",
				baseVersion,
				newVersion,
				modifications: [remove],
			};
		}
	}
};

// node_modules/convex/dist/esm/browser/sync/request_manager.js
var __defProp6 = Object.defineProperty;
var __defNormalProp5 = (obj, key, value) =>
	key in obj
		? __defProp6(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField5 = (obj, key, value) =>
	__defNormalProp5(obj, typeof key !== "symbol" ? key + "" : key, value);
var RequestManager = class {
	constructor(logger, markConnectionStateDirty) {
		this.logger = logger;
		this.markConnectionStateDirty = markConnectionStateDirty;
		__publicField5(this, "inflightRequests");
		__publicField5(this, "requestsOlderThanRestart");
		__publicField5(this, "inflightMutationsCount", 0);
		__publicField5(this, "inflightActionsCount", 0);
		this.inflightRequests = /* @__PURE__ */ new Map();
		this.requestsOlderThanRestart = /* @__PURE__ */ new Set();
	}
	request(message, sent) {
		const result2 = new Promise((resolve) => {
			const status2 = sent ? "Requested" : "NotSent";
			this.inflightRequests.set(message.requestId, {
				message,
				status: {
					status: status2,
					requestedAt: /* @__PURE__ */ new Date(),
					onResult: resolve,
				},
			});
			if (message.type === "Mutation") {
				this.inflightMutationsCount++;
			} else if (message.type === "Action") {
				this.inflightActionsCount++;
			}
		});
		this.markConnectionStateDirty();
		return result2;
	}
	/**
	 * Update the state after receiving a response.
	 *
	 * @returns A RequestId if the request is complete and its optimistic update
	 * can be dropped, null otherwise.
	 */
	onResponse(response) {
		const requestInfo = this.inflightRequests.get(response.requestId);
		if (requestInfo === void 0) {
			return null;
		}
		if (requestInfo.status.status === "Completed") {
			return null;
		}
		const udfType =
			requestInfo.message.type === "Mutation" ? "mutation" : "action";
		const udfPath = requestInfo.message.udfPath;
		for (const line of response.logLines) {
			logForFunction(this.logger, "info", udfType, udfPath, line);
		}
		const status2 = requestInfo.status;
		let result2;
		let onResolve;
		if (response.success) {
			result2 = {
				success: true,
				logLines: response.logLines,
				value: jsonToConvex(response.result),
			};
			onResolve = () => status2.onResult(result2);
		} else {
			const errorMessage = response.result;
			const { errorData } = response;
			logForFunction(this.logger, "error", udfType, udfPath, errorMessage);
			result2 = {
				success: false,
				errorMessage,
				errorData: errorData !== void 0 ? jsonToConvex(errorData) : void 0,
				logLines: response.logLines,
			};
			onResolve = () => status2.onResult(result2);
		}
		if (response.type === "ActionResponse" || !response.success) {
			onResolve();
			this.inflightRequests.delete(response.requestId);
			this.requestsOlderThanRestart.delete(response.requestId);
			if (requestInfo.message.type === "Action") {
				this.inflightActionsCount--;
			} else if (requestInfo.message.type === "Mutation") {
				this.inflightMutationsCount--;
			}
			this.markConnectionStateDirty();
			return { requestId: response.requestId, result: result2 };
		}
		requestInfo.status = {
			status: "Completed",
			result: result2,
			ts: response.ts,
			onResolve,
		};
		return null;
	}
	// Remove and returns completed requests.
	removeCompleted(ts) {
		const completeRequests = /* @__PURE__ */ new Map();
		for (const [requestId, requestInfo] of this.inflightRequests.entries()) {
			const status2 = requestInfo.status;
			if (status2.status === "Completed" && status2.ts.lessThanOrEqual(ts)) {
				status2.onResolve();
				completeRequests.set(requestId, status2.result);
				if (requestInfo.message.type === "Mutation") {
					this.inflightMutationsCount--;
				} else if (requestInfo.message.type === "Action") {
					this.inflightActionsCount--;
				}
				this.inflightRequests.delete(requestId);
				this.requestsOlderThanRestart.delete(requestId);
			}
		}
		if (completeRequests.size > 0) {
			this.markConnectionStateDirty();
		}
		return completeRequests;
	}
	restart() {
		this.requestsOlderThanRestart = new Set(this.inflightRequests.keys());
		const allMessages = [];
		for (const [requestId, value] of this.inflightRequests) {
			if (value.status.status === "NotSent") {
				value.status.status = "Requested";
				allMessages.push(value.message);
				continue;
			}
			if (value.message.type === "Mutation") {
				allMessages.push(value.message);
			} else if (value.message.type === "Action") {
				this.inflightRequests.delete(requestId);
				this.requestsOlderThanRestart.delete(requestId);
				this.inflightActionsCount--;
				if (value.status.status === "Completed") {
					throw new Error("Action should never be in 'Completed' state");
				}
				value.status.onResult({
					success: false,
					errorMessage: "Connection lost while action was in flight",
					logLines: [],
				});
			}
		}
		this.markConnectionStateDirty();
		return allMessages;
	}
	resume() {
		const allMessages = [];
		for (const [, value] of this.inflightRequests) {
			if (value.status.status === "NotSent") {
				value.status.status = "Requested";
				allMessages.push(value.message);
				continue;
			}
		}
		return allMessages;
	}
	/**
	 * @returns true if there are any requests that have been requested but have
	 * not be completed yet.
	 */
	hasIncompleteRequests() {
		for (const requestInfo of this.inflightRequests.values()) {
			if (requestInfo.status.status === "Requested") {
				return true;
			}
		}
		return false;
	}
	/**
	 * @returns true if there are any inflight requests, including ones that have
	 * completed on the server, but have not been applied.
	 */
	hasInflightRequests() {
		return this.inflightRequests.size > 0;
	}
	/**
	 * @returns true if there are any inflight requests, that have been hanging around
	 * since prior to the most recent restart.
	 */
	hasSyncedPastLastReconnect() {
		return this.requestsOlderThanRestart.size === 0;
	}
	timeOfOldestInflightRequest() {
		if (this.inflightRequests.size === 0) {
			return null;
		}
		let oldestInflightRequest = Date.now();
		for (const request of this.inflightRequests.values()) {
			if (request.status.status !== "Completed") {
				if (request.status.requestedAt.getTime() < oldestInflightRequest) {
					oldestInflightRequest = request.status.requestedAt.getTime();
				}
			}
		}
		return new Date(oldestInflightRequest);
	}
	/**
	 * @returns The number of mutations currently in flight.
	 */
	inflightMutations() {
		return this.inflightMutationsCount;
	}
	/**
	 * @returns The number of actions currently in flight.
	 */
	inflightActions() {
		return this.inflightActionsCount;
	}
};

// node_modules/convex/dist/esm/server/functionName.js
var functionName = /* @__PURE__ */ Symbol.for("functionName");

// node_modules/convex/dist/esm/server/components/paths.js
var toReferencePath = /* @__PURE__ */ Symbol.for("toReferencePath");
function extractReferencePath(reference) {
	return reference[toReferencePath] ?? null;
}
function isFunctionHandle(s) {
	return s.startsWith("function://");
}
function getFunctionAddress(functionReference) {
	let functionAddress;
	if (typeof functionReference === "string") {
		if (isFunctionHandle(functionReference)) {
			functionAddress = { functionHandle: functionReference };
		} else {
			functionAddress = { name: functionReference };
		}
	} else if (functionReference[functionName]) {
		functionAddress = { name: functionReference[functionName] };
	} else {
		const referencePath = extractReferencePath(functionReference);
		if (!referencePath) {
			throw new Error(`${functionReference} is not a functionReference`);
		}
		functionAddress = { reference: referencePath };
	}
	return functionAddress;
}

// node_modules/convex/dist/esm/server/api.js
function getFunctionName(functionReference) {
	const address = getFunctionAddress(functionReference);
	if (address.name === void 0) {
		if (address.functionHandle !== void 0) {
			throw new Error(
				`Expected function reference like "api.file.func" or "internal.file.func", but received function handle ${address.functionHandle}`,
			);
		} else if (address.reference !== void 0) {
			throw new Error(
				`Expected function reference in the current component like "api.file.func" or "internal.file.func", but received reference ${address.reference}`,
			);
		}
		throw new Error(
			`Expected function reference like "api.file.func" or "internal.file.func", but received ${JSON.stringify(address)}`,
		);
	}
	if (typeof functionReference === "string") return functionReference;
	const name = functionReference[functionName];
	if (!name) {
		throw new Error(`${functionReference} is not a functionReference`);
	}
	return name;
}
function createApi(pathParts = []) {
	const handler = {
		get(_, prop) {
			if (typeof prop === "string") {
				const newParts = [...pathParts, prop];
				return createApi(newParts);
			} else if (prop === functionName) {
				if (pathParts.length < 2) {
					const found = ["api", ...pathParts].join(".");
					throw new Error(
						`API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``,
					);
				}
				const path = pathParts.slice(0, -1).join("/");
				const exportName = pathParts[pathParts.length - 1];
				if (exportName === "default") {
					return path;
				} else {
					return path + ":" + exportName;
				}
			} else if (prop === Symbol.toStringTag) {
				return "FunctionReference";
			} else {
				return void 0;
			}
		},
	};
	return new Proxy({}, handler);
}
var anyApi = createApi();

// node_modules/convex/dist/esm/browser/sync/optimistic_updates_impl.js
var __defProp7 = Object.defineProperty;
var __defNormalProp6 = (obj, key, value) =>
	key in obj
		? __defProp7(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField6 = (obj, key, value) =>
	__defNormalProp6(obj, typeof key !== "symbol" ? key + "" : key, value);
var OptimisticLocalStoreImpl = class _OptimisticLocalStoreImpl {
	constructor(queryResults) {
		__publicField6(this, "queryResults");
		__publicField6(this, "modifiedQueries");
		this.queryResults = queryResults;
		this.modifiedQueries = [];
	}
	getQuery(query, ...args) {
		const queryArgs = parseArgs(args[0]);
		const name = getFunctionName(query);
		const queryResult = this.queryResults.get(
			serializePathAndArgs(name, queryArgs),
		);
		if (queryResult === void 0) {
			return void 0;
		}
		return _OptimisticLocalStoreImpl.queryValue(queryResult.result);
	}
	getAllQueries(query) {
		const queriesWithName = [];
		const name = getFunctionName(query);
		for (const queryResult of this.queryResults.values()) {
			if (queryResult.udfPath === canonicalizeUdfPath(name)) {
				queriesWithName.push({
					args: queryResult.args,
					value: _OptimisticLocalStoreImpl.queryValue(queryResult.result),
				});
			}
		}
		return queriesWithName;
	}
	setQuery(queryReference, args, value) {
		const queryArgs = parseArgs(args);
		const name = getFunctionName(queryReference);
		const queryToken = serializePathAndArgs(name, queryArgs);
		let result2;
		if (value === void 0) {
			result2 = void 0;
		} else {
			result2 = {
				success: true,
				value,
				// It's an optimistic update, so there are no function logs to show.
				logLines: [],
			};
		}
		const query = {
			udfPath: name,
			args: queryArgs,
			result: result2,
		};
		this.queryResults.set(queryToken, query);
		this.modifiedQueries.push(queryToken);
	}
	static queryValue(result2) {
		if (result2 === void 0) {
			return void 0;
		} else if (result2.success) {
			return result2.value;
		} else {
			return void 0;
		}
	}
};
var OptimisticQueryResults = class {
	constructor() {
		__publicField6(this, "queryResults");
		__publicField6(this, "optimisticUpdates");
		this.queryResults = /* @__PURE__ */ new Map();
		this.optimisticUpdates = [];
	}
	/**
	 * Apply all optimistic updates on top of server query results
	 */
	ingestQueryResultsFromServer(serverQueryResults, optimisticUpdatesToDrop) {
		this.optimisticUpdates = this.optimisticUpdates.filter((updateAndId) => {
			return !optimisticUpdatesToDrop.has(updateAndId.mutationId);
		});
		const oldQueryResults = this.queryResults;
		this.queryResults = new Map(serverQueryResults);
		const localStore = new OptimisticLocalStoreImpl(this.queryResults);
		for (const updateAndId of this.optimisticUpdates) {
			updateAndId.update(localStore);
		}
		const changedQueries = [];
		for (const [queryToken, query] of this.queryResults) {
			const oldQuery = oldQueryResults.get(queryToken);
			if (oldQuery === void 0 || oldQuery.result !== query.result) {
				changedQueries.push(queryToken);
			}
		}
		return changedQueries;
	}
	applyOptimisticUpdate(update, mutationId) {
		this.optimisticUpdates.push({
			update,
			mutationId,
		});
		const localStore = new OptimisticLocalStoreImpl(this.queryResults);
		update(localStore);
		return localStore.modifiedQueries;
	}
	/**
	 * "Raw" with respect to errors vs values, but query results still have
	 * optimistic updates applied.
	 *
	 * @internal
	 */
	rawQueryResult(queryToken) {
		const query = this.queryResults.get(queryToken);
		if (query === void 0) {
			return void 0;
		}
		return query.result;
	}
	queryResult(queryToken) {
		const query = this.queryResults.get(queryToken);
		if (query === void 0) {
			return void 0;
		}
		const result2 = query.result;
		if (result2 === void 0) {
			return void 0;
		} else if (result2.success) {
			return result2.value;
		} else {
			if (result2.errorData !== void 0) {
				throw forwardData(
					result2,
					new ConvexError(
						createHybridErrorStacktrace("query", query.udfPath, result2),
					),
				);
			}
			throw new Error(
				createHybridErrorStacktrace("query", query.udfPath, result2),
			);
		}
	}
	hasQueryResult(queryToken) {
		return this.queryResults.get(queryToken) !== void 0;
	}
	/**
	 * @internal
	 */
	queryLogs(queryToken) {
		const query = this.queryResults.get(queryToken);
		return query?.result?.logLines;
	}
};

// node_modules/convex/dist/esm/vendor/long.js
var __defProp8 = Object.defineProperty;
var __defNormalProp7 = (obj, key, value) =>
	key in obj
		? __defProp8(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField7 = (obj, key, value) =>
	__defNormalProp7(obj, typeof key !== "symbol" ? key + "" : key, value);
var Long = class _Long {
	constructor(low, high) {
		__publicField7(this, "low");
		__publicField7(this, "high");
		__publicField7(this, "__isUnsignedLong__");
		this.low = low | 0;
		this.high = high | 0;
		this.__isUnsignedLong__ = true;
	}
	static isLong(obj) {
		return (obj && obj.__isUnsignedLong__) === true;
	}
	// prettier-ignore
	static fromBytesLE(bytes) {
    return new _Long(
      bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24,
      bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24
    );
  }
	// prettier-ignore
	toBytesLE() {
    const hi = this.high;
    const lo = this.low;
    return [
      lo & 255,
      lo >>> 8 & 255,
      lo >>> 16 & 255,
      lo >>> 24,
      hi & 255,
      hi >>> 8 & 255,
      hi >>> 16 & 255,
      hi >>> 24
    ];
  }
	static fromNumber(value) {
		if (isNaN(value)) return UZERO;
		if (value < 0) return UZERO;
		if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
		return new _Long(
			(value % TWO_PWR_32_DBL) | 0,
			(value / TWO_PWR_32_DBL) | 0,
		);
	}
	toString() {
		return (
			BigInt(this.high) * BigInt(TWO_PWR_32_DBL) +
			BigInt(this.low)
		).toString();
	}
	equals(other) {
		if (!_Long.isLong(other)) other = _Long.fromValue(other);
		if (this.high >>> 31 === 1 && other.high >>> 31 === 1) return false;
		return this.high === other.high && this.low === other.low;
	}
	notEquals(other) {
		return !this.equals(other);
	}
	comp(other) {
		if (!_Long.isLong(other)) other = _Long.fromValue(other);
		if (this.equals(other)) return 0;
		return other.high >>> 0 > this.high >>> 0 ||
			(other.high === this.high && other.low >>> 0 > this.low >>> 0)
			? -1
			: 1;
	}
	lessThanOrEqual(other) {
		return (
			this.comp(
				/* validates */
				other,
			) <= 0
		);
	}
	static fromValue(val) {
		if (typeof val === "number") return _Long.fromNumber(val);
		return new _Long(val.low, val.high);
	}
};
var UZERO = new Long(0, 0);
var TWO_PWR_16_DBL = 1 << 16;
var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
var MAX_UNSIGNED_VALUE = new Long(4294967295 | 0, 4294967295 | 0);

// node_modules/convex/dist/esm/browser/sync/remote_query_set.js
var __defProp9 = Object.defineProperty;
var __defNormalProp8 = (obj, key, value) =>
	key in obj
		? __defProp9(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField8 = (obj, key, value) =>
	__defNormalProp8(obj, typeof key !== "symbol" ? key + "" : key, value);
var RemoteQuerySet = class {
	constructor(queryPath, logger) {
		__publicField8(this, "version");
		__publicField8(this, "remoteQuerySet");
		__publicField8(this, "queryPath");
		__publicField8(this, "logger");
		this.version = { querySet: 0, ts: Long.fromNumber(0), identity: 0 };
		this.remoteQuerySet = /* @__PURE__ */ new Map();
		this.queryPath = queryPath;
		this.logger = logger;
	}
	transition(transition) {
		const start = transition.startVersion;
		if (
			this.version.querySet !== start.querySet ||
			this.version.ts.notEquals(start.ts) ||
			this.version.identity !== start.identity
		) {
			throw new Error(
				`Invalid start version: ${start.ts.toString()}:${start.querySet}:${start.identity}, transitioning from ${this.version.ts.toString()}:${this.version.querySet}:${this.version.identity}`,
			);
		}
		for (const modification of transition.modifications) {
			switch (modification.type) {
				case "QueryUpdated": {
					const queryPath = this.queryPath(modification.queryId);
					if (queryPath) {
						for (const line of modification.logLines) {
							logForFunction(this.logger, "info", "query", queryPath, line);
						}
					}
					const value = jsonToConvex(modification.value ?? null);
					this.remoteQuerySet.set(modification.queryId, {
						success: true,
						value,
						logLines: modification.logLines,
					});
					break;
				}
				case "QueryFailed": {
					const queryPath = this.queryPath(modification.queryId);
					if (queryPath) {
						for (const line of modification.logLines) {
							logForFunction(this.logger, "info", "query", queryPath, line);
						}
					}
					const { errorData } = modification;
					this.remoteQuerySet.set(modification.queryId, {
						success: false,
						errorMessage: modification.errorMessage,
						errorData: errorData !== void 0 ? jsonToConvex(errorData) : void 0,
						logLines: modification.logLines,
					});
					break;
				}
				case "QueryRemoved": {
					this.remoteQuerySet.delete(modification.queryId);
					break;
				}
				default: {
					modification;
					throw new Error(`Invalid modification ${modification.type}`);
				}
			}
		}
		this.version = transition.endVersion;
	}
	remoteQueryResults() {
		return this.remoteQuerySet;
	}
	timestamp() {
		return this.version.ts;
	}
};

// node_modules/convex/dist/esm/browser/sync/protocol.js
function u64ToLong(encoded) {
	const integerBytes = base64_exports.toByteArray(encoded);
	return Long.fromBytesLE(Array.from(integerBytes));
}
function longToU64(raw) {
	const integerBytes = new Uint8Array(raw.toBytesLE());
	return base64_exports.fromByteArray(integerBytes);
}
function parseServerMessage(encoded) {
	switch (encoded.type) {
		case "FatalError":
		case "AuthError":
		case "ActionResponse":
		case "TransitionChunk":
		case "Ping": {
			return { ...encoded };
		}
		case "MutationResponse": {
			if (encoded.success) {
				return { ...encoded, ts: u64ToLong(encoded.ts) };
			} else {
				return { ...encoded };
			}
		}
		case "Transition": {
			return {
				...encoded,
				startVersion: {
					...encoded.startVersion,
					ts: u64ToLong(encoded.startVersion.ts),
				},
				endVersion: {
					...encoded.endVersion,
					ts: u64ToLong(encoded.endVersion.ts),
				},
			};
		}
		default: {
			encoded;
		}
	}
	return void 0;
}
function encodeClientMessage(message) {
	switch (message.type) {
		case "Authenticate":
		case "ModifyQuerySet":
		case "Mutation":
		case "Action":
		case "Event": {
			return { ...message };
		}
		case "Connect": {
			if (message.maxObservedTimestamp !== void 0) {
				return {
					...message,
					maxObservedTimestamp: longToU64(message.maxObservedTimestamp),
				};
			} else {
				return { ...message, maxObservedTimestamp: void 0 };
			}
		}
		default: {
			message;
		}
	}
	return void 0;
}

// node_modules/convex/dist/esm/browser/sync/web_socket_manager.js
var __defProp10 = Object.defineProperty;
var __defNormalProp9 = (obj, key, value) =>
	key in obj
		? __defProp10(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField9 = (obj, key, value) =>
	__defNormalProp9(obj, typeof key !== "symbol" ? key + "" : key, value);
var CLOSE_NORMAL = 1e3;
var CLOSE_GOING_AWAY = 1001;
var CLOSE_NO_STATUS = 1005;
var CLOSE_NOT_FOUND = 4040;
var firstTime;
function monotonicMillis() {
	if (firstTime === void 0) {
		firstTime = Date.now();
	}
	if (typeof performance === "undefined" || !performance.now) {
		return Date.now();
	}
	return Math.round(firstTime + performance.now());
}
function prettyNow() {
	return `t=${Math.round((monotonicMillis() - firstTime) / 100) / 10}s`;
}
var serverDisconnectErrors = {
	// A known error, e.g. during a restart or push
	InternalServerError: { timeout: 1e3 },
	// ErrorMetadata::overloaded() messages that we realy should back off
	SubscriptionsWorkerFullError: { timeout: 3e3 },
	TooManyConcurrentRequests: { timeout: 3e3 },
	CommitterFullError: { timeout: 3e3 },
	AwsTooManyRequestsException: { timeout: 3e3 },
	ExecuteFullError: { timeout: 3e3 },
	SystemTimeoutError: { timeout: 3e3 },
	ExpiredInQueue: { timeout: 3e3 },
	// ErrorMetadata::feature_temporarily_unavailable() that typically indicate a deploy just happened
	VectorIndexesUnavailable: { timeout: 1e3 },
	SearchIndexesUnavailable: { timeout: 1e3 },
	TableSummariesUnavailable: { timeout: 1e3 },
	// More ErrorMetadata::overloaded()
	VectorIndexTooLarge: { timeout: 3e3 },
	SearchIndexTooLarge: { timeout: 3e3 },
	TooManyWritesInTimePeriod: { timeout: 3e3 },
};
function classifyDisconnectError(s) {
	if (s === void 0) return "Unknown";
	for (const prefix of Object.keys(serverDisconnectErrors)) {
		if (s.startsWith(prefix)) {
			return prefix;
		}
	}
	return "Unknown";
}
var WebSocketManager = class {
	constructor(
		uri,
		callbacks,
		webSocketConstructor,
		logger,
		markConnectionStateDirty,
		debug,
	) {
		this.markConnectionStateDirty = markConnectionStateDirty;
		this.debug = debug;
		__publicField9(this, "socket");
		__publicField9(this, "connectionCount");
		__publicField9(this, "_hasEverConnected", false);
		__publicField9(this, "lastCloseReason");
		__publicField9(this, "transitionChunkBuffer", null);
		__publicField9(this, "defaultInitialBackoff");
		__publicField9(this, "maxBackoff");
		__publicField9(this, "retries");
		__publicField9(this, "serverInactivityThreshold");
		__publicField9(this, "reconnectDueToServerInactivityTimeout");
		__publicField9(this, "scheduledReconnect", null);
		__publicField9(this, "networkOnlineHandler", null);
		__publicField9(this, "pendingNetworkRecoveryInfo", null);
		__publicField9(this, "uri");
		__publicField9(this, "onOpen");
		__publicField9(this, "onResume");
		__publicField9(this, "onMessage");
		__publicField9(this, "webSocketConstructor");
		__publicField9(this, "logger");
		__publicField9(this, "onServerDisconnectError");
		this.webSocketConstructor = webSocketConstructor;
		this.socket = { state: "disconnected" };
		this.connectionCount = 0;
		this.lastCloseReason = "InitialConnect";
		this.defaultInitialBackoff = 1e3;
		this.maxBackoff = 16e3;
		this.retries = 0;
		this.serverInactivityThreshold = 6e4;
		this.reconnectDueToServerInactivityTimeout = null;
		this.uri = uri;
		this.onOpen = callbacks.onOpen;
		this.onResume = callbacks.onResume;
		this.onMessage = callbacks.onMessage;
		this.onServerDisconnectError = callbacks.onServerDisconnectError;
		this.logger = logger;
		this.setupNetworkListener();
		this.connect();
	}
	setSocketState(state) {
		this.socket = state;
		this._logVerbose(
			`socket state changed: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}`,
		);
		this.markConnectionStateDirty();
	}
	setupNetworkListener() {
		if (
			typeof window === "undefined" ||
			typeof window.addEventListener !== "function"
		) {
			return;
		}
		if (this.networkOnlineHandler !== null) {
			return;
		}
		this.networkOnlineHandler = () => {
			this._logVerbose("network online event detected");
			this.tryReconnectImmediately();
		};
		window.addEventListener("online", this.networkOnlineHandler);
		this._logVerbose("network online event listener registered");
	}
	cleanupNetworkListener() {
		if (
			this.networkOnlineHandler &&
			typeof window !== "undefined" &&
			typeof window.removeEventListener === "function"
		) {
			window.removeEventListener("online", this.networkOnlineHandler);
			this.networkOnlineHandler = null;
			this._logVerbose("network online event listener removed");
		}
	}
	assembleTransition(chunk) {
		if (
			chunk.partNumber < 0 ||
			chunk.partNumber >= chunk.totalParts ||
			chunk.totalParts === 0 ||
			(this.transitionChunkBuffer &&
				(this.transitionChunkBuffer.totalParts !== chunk.totalParts ||
					this.transitionChunkBuffer.transitionId !== chunk.transitionId))
		) {
			this.transitionChunkBuffer = null;
			throw new Error("Invalid TransitionChunk");
		}
		if (this.transitionChunkBuffer === null) {
			this.transitionChunkBuffer = {
				chunks: [],
				totalParts: chunk.totalParts,
				transitionId: chunk.transitionId,
			};
		}
		if (chunk.partNumber !== this.transitionChunkBuffer.chunks.length) {
			const expectedLength = this.transitionChunkBuffer.chunks.length;
			this.transitionChunkBuffer = null;
			throw new Error(
				`TransitionChunk received out of order: expected part ${expectedLength}, got ${chunk.partNumber}`,
			);
		}
		this.transitionChunkBuffer.chunks.push(chunk.chunk);
		if (this.transitionChunkBuffer.chunks.length === chunk.totalParts) {
			const fullJson = this.transitionChunkBuffer.chunks.join("");
			this.transitionChunkBuffer = null;
			const transition = parseServerMessage(JSON.parse(fullJson));
			if (transition.type !== "Transition") {
				throw new Error(
					`Expected Transition, got ${transition.type} after assembling chunks`,
				);
			}
			return transition;
		}
		return null;
	}
	connect() {
		if (this.socket.state === "terminated") {
			return;
		}
		if (
			this.socket.state !== "disconnected" &&
			this.socket.state !== "stopped"
		) {
			throw new Error(
				"Didn't start connection from disconnected state: " + this.socket.state,
			);
		}
		const ws = new this.webSocketConstructor(this.uri);
		this._logVerbose("constructed WebSocket");
		this.setSocketState({
			state: "connecting",
			ws,
			paused: "no",
		});
		this.resetServerInactivityTimeout();
		ws.onopen = () => {
			this.logger.logVerbose("begin ws.onopen");
			if (this.socket.state !== "connecting") {
				throw new Error("onopen called with socket not in connecting state");
			}
			this.setSocketState({
				state: "ready",
				ws,
				paused: this.socket.paused === "yes" ? "uninitialized" : "no",
			});
			this.resetServerInactivityTimeout();
			if (this.socket.paused === "no") {
				this._hasEverConnected = true;
				this.onOpen({
					connectionCount: this.connectionCount,
					lastCloseReason: this.lastCloseReason,
					clientTs: monotonicMillis(),
				});
			}
			if (this.lastCloseReason !== "InitialConnect") {
				if (this.lastCloseReason) {
					this.logger.log(
						"WebSocket reconnected at",
						prettyNow(),
						"after disconnect due to",
						this.lastCloseReason,
					);
				} else {
					this.logger.log("WebSocket reconnected at", prettyNow());
				}
			}
			this.connectionCount += 1;
			this.lastCloseReason = null;
			if (this.pendingNetworkRecoveryInfo !== null) {
				const { timeSavedMs } = this.pendingNetworkRecoveryInfo;
				this.pendingNetworkRecoveryInfo = null;
				this.sendMessage({
					type: "Event",
					eventType: "NetworkRecoveryReconnect",
					event: { timeSavedMs },
				});
				this.logger.log(
					`Network recovery reconnect saved ~${Math.round(timeSavedMs / 1e3)}s of waiting`,
				);
			}
		};
		ws.onerror = (error) => {
			this.transitionChunkBuffer = null;
			const message = error.message;
			if (message) {
				this.logger.log(`WebSocket error message: ${message}`);
			}
		};
		ws.onmessage = (message) => {
			this.resetServerInactivityTimeout();
			const messageLength = message.data.length;
			let serverMessage = parseServerMessage(JSON.parse(message.data));
			this._logVerbose(`received ws message with type ${serverMessage.type}`);
			if (serverMessage.type === "Ping") {
				return;
			}
			if (serverMessage.type === "TransitionChunk") {
				const transition = this.assembleTransition(serverMessage);
				if (!transition) {
					return;
				}
				serverMessage = transition;
				this._logVerbose(
					`assembled full ws message of type ${serverMessage.type}`,
				);
			}
			if (this.transitionChunkBuffer !== null) {
				this.transitionChunkBuffer = null;
				this.logger.log(
					`Received unexpected ${serverMessage.type} while buffering TransitionChunks`,
				);
			}
			if (serverMessage.type === "Transition") {
				this.reportLargeTransition({
					messageLength,
					transition: serverMessage,
				});
			}
			const response = this.onMessage(serverMessage);
			if (response.hasSyncedPastLastReconnect) {
				this.retries = 0;
				this.markConnectionStateDirty();
			}
		};
		ws.onclose = (event) => {
			this._logVerbose("begin ws.onclose");
			this.transitionChunkBuffer = null;
			if (this.lastCloseReason === null) {
				this.lastCloseReason = event.reason || `closed with code ${event.code}`;
			}
			if (
				event.code !== CLOSE_NORMAL &&
				event.code !== CLOSE_GOING_AWAY && // This commonly gets fired on mobile apps when the app is backgrounded
				event.code !== CLOSE_NO_STATUS &&
				event.code !== CLOSE_NOT_FOUND
			) {
				let msg = `WebSocket closed with code ${event.code}`;
				if (event.reason) {
					msg += `: ${event.reason}`;
				}
				this.logger.log(msg);
				if (this.onServerDisconnectError && event.reason) {
					this.onServerDisconnectError(msg);
				}
			}
			const reason = classifyDisconnectError(event.reason);
			this.scheduleReconnect(reason);
			return;
		};
	}
	/**
	 * @returns The state of the {@link Socket}.
	 */
	socketState() {
		return this.socket.state;
	}
	/**
	 * @param message - A ClientMessage to send.
	 * @returns Whether the message (might have been) sent.
	 */
	sendMessage(message) {
		const messageForLog = {
			type: message.type,
			...(message.type === "Authenticate" && message.tokenType === "User"
				? {
						value: `...${message.value.slice(-7)}`,
					}
				: {}),
		};
		if (this.socket.state === "ready" && this.socket.paused === "no") {
			const encodedMessage = encodeClientMessage(message);
			const request = JSON.stringify(encodedMessage);
			let sent = false;
			try {
				this.socket.ws.send(request);
				sent = true;
			} catch (error) {
				this.logger.log(
					`Failed to send message on WebSocket, reconnecting: ${error}`,
				);
				this.closeAndReconnect("FailedToSendMessage");
			}
			this._logVerbose(
				`${sent ? "sent" : "failed to send"} message with type ${message.type}: ${JSON.stringify(
					messageForLog,
				)}`,
			);
			return true;
		}
		this._logVerbose(
			`message not sent (socket state: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}): ${JSON.stringify(
				messageForLog,
			)}`,
		);
		return false;
	}
	resetServerInactivityTimeout() {
		if (this.socket.state === "terminated") {
			return;
		}
		if (this.reconnectDueToServerInactivityTimeout !== null) {
			clearTimeout(this.reconnectDueToServerInactivityTimeout);
			this.reconnectDueToServerInactivityTimeout = null;
		}
		this.reconnectDueToServerInactivityTimeout = setTimeout(() => {
			this.closeAndReconnect("InactiveServer");
		}, this.serverInactivityThreshold);
	}
	scheduleReconnect(reason) {
		if (this.scheduledReconnect) {
			clearTimeout(this.scheduledReconnect.timeout);
			this.scheduledReconnect = null;
		}
		this.socket = { state: "disconnected" };
		const backoff = this.nextBackoff(reason);
		this.markConnectionStateDirty();
		this.logger.log(`Attempting reconnect in ${Math.round(backoff)}ms`);
		const scheduledAt = monotonicMillis();
		const timeoutId = setTimeout(() => {
			if (this.scheduledReconnect?.timeout === timeoutId) {
				this.scheduledReconnect = null;
				this.connect();
			}
		}, backoff);
		this.scheduledReconnect = {
			timeout: timeoutId,
			scheduledAt,
			backoffMs: backoff,
		};
	}
	/**
	 * Close the WebSocket and schedule a reconnect.
	 *
	 * This should be used when we hit an error and would like to restart the session.
	 */
	closeAndReconnect(closeReason) {
		this._logVerbose(`begin closeAndReconnect with reason ${closeReason}`);
		switch (this.socket.state) {
			case "disconnected":
			case "terminated":
			case "stopped":
				return;
			case "connecting":
			case "ready": {
				this.lastCloseReason = closeReason;
				void this.close();
				this.scheduleReconnect("client");
				return;
			}
			default: {
				this.socket;
			}
		}
	}
	/**
	 * Close the WebSocket, being careful to clear the onclose handler to avoid re-entrant
	 * calls. Use this instead of directly calling `ws.close()`
	 *
	 * It is the callers responsibility to update the state after this method is called so that the
	 * closed socket is not accessible or used again after this method is called
	 */
	close() {
		this.transitionChunkBuffer = null;
		switch (this.socket.state) {
			case "disconnected":
			case "terminated":
			case "stopped":
				return Promise.resolve();
			case "connecting": {
				const ws = this.socket.ws;
				ws.onmessage = (_message) => {
					this._logVerbose("Ignoring message received after close");
				};
				return new Promise((r) => {
					ws.onclose = () => {
						this._logVerbose("Closed after connecting");
						r();
					};
					ws.onopen = () => {
						this._logVerbose("Opened after connecting");
						ws.close();
					};
				});
			}
			case "ready": {
				this._logVerbose("ws.close called");
				const ws = this.socket.ws;
				ws.onmessage = (_message) => {
					this._logVerbose("Ignoring message received after close");
				};
				const result2 = new Promise((r) => {
					ws.onclose = () => {
						r();
					};
				});
				ws.close();
				return result2;
			}
			default: {
				this.socket;
				return Promise.resolve();
			}
		}
	}
	/**
	 * Close the WebSocket and do not reconnect.
	 * @returns A Promise that resolves when the WebSocket `onClose` callback is called.
	 */
	terminate() {
		if (this.reconnectDueToServerInactivityTimeout) {
			clearTimeout(this.reconnectDueToServerInactivityTimeout);
		}
		if (this.scheduledReconnect) {
			clearTimeout(this.scheduledReconnect.timeout);
			this.scheduledReconnect = null;
		}
		this.cleanupNetworkListener();
		switch (this.socket.state) {
			case "terminated":
			case "stopped":
			case "disconnected":
			case "connecting":
			case "ready": {
				const result2 = this.close();
				this.setSocketState({ state: "terminated" });
				return result2;
			}
			default: {
				this.socket;
				throw new Error(`Invalid websocket state: ${this.socket.state}`);
			}
		}
	}
	stop() {
		switch (this.socket.state) {
			case "terminated":
				return Promise.resolve();
			case "connecting":
			case "stopped":
			case "disconnected":
			case "ready": {
				this.cleanupNetworkListener();
				const result2 = this.close();
				this.socket = { state: "stopped" };
				return result2;
			}
			default: {
				this.socket;
				return Promise.resolve();
			}
		}
	}
	/**
	 * Create a new WebSocket after a previous `stop()`, unless `terminate()` was
	 * called before.
	 */
	tryRestart() {
		switch (this.socket.state) {
			case "stopped":
				break;
			case "terminated":
			case "connecting":
			case "ready":
			case "disconnected":
				this.logger.logVerbose("Restart called without stopping first");
				return;
			default: {
				this.socket;
			}
		}
		this.setupNetworkListener();
		this.connect();
	}
	pause() {
		switch (this.socket.state) {
			case "disconnected":
			case "stopped":
			case "terminated":
				return;
			case "connecting":
			case "ready": {
				this.socket = { ...this.socket, paused: "yes" };
				return;
			}
			default: {
				this.socket;
				return;
			}
		}
	}
	/**
	 * Try to reconnect immediately, canceling any scheduled reconnect.
	 * This is useful when detecting network recovery.
	 * Only takes action if we're in disconnected state (waiting to reconnect).
	 */
	tryReconnectImmediately() {
		this._logVerbose("tryReconnectImmediately called");
		if (this.socket.state !== "disconnected") {
			this._logVerbose(
				`tryReconnectImmediately called but socket state is ${this.socket.state}, no action taken`,
			);
			return;
		}
		let timeSavedMs = null;
		if (this.scheduledReconnect) {
			const elapsed = monotonicMillis() - this.scheduledReconnect.scheduledAt;
			timeSavedMs = Math.max(0, this.scheduledReconnect.backoffMs - elapsed);
			this._logVerbose(
				`would have waited ${Math.round(timeSavedMs)}ms more (backoff was ${Math.round(this.scheduledReconnect.backoffMs)}ms, elapsed ${Math.round(elapsed)}ms)`,
			);
			clearTimeout(this.scheduledReconnect.timeout);
			this.scheduledReconnect = null;
			this._logVerbose("canceled scheduled reconnect");
		}
		this.logger.log("Network recovery detected, reconnecting immediately");
		this.pendingNetworkRecoveryInfo =
			timeSavedMs !== null ? { timeSavedMs } : null;
		this.connect();
	}
	/**
	 * Resume the state machine if previously paused.
	 */
	resume() {
		switch (this.socket.state) {
			case "connecting":
				this.socket = { ...this.socket, paused: "no" };
				return;
			case "ready":
				if (this.socket.paused === "uninitialized") {
					this.socket = { ...this.socket, paused: "no" };
					this._hasEverConnected = true;
					this.onOpen({
						connectionCount: this.connectionCount,
						lastCloseReason: this.lastCloseReason,
						clientTs: monotonicMillis(),
					});
				} else if (this.socket.paused === "yes") {
					this.socket = { ...this.socket, paused: "no" };
					this.onResume();
				}
				return;
			case "terminated":
			case "stopped":
			case "disconnected":
				return;
			default: {
				this.socket;
			}
		}
		this.connect();
	}
	connectionState() {
		return {
			isConnected: this.socket.state === "ready",
			hasEverConnected: this._hasEverConnected,
			connectionCount: this.connectionCount,
			connectionRetries: this.retries,
		};
	}
	_logVerbose(message) {
		this.logger.logVerbose(message);
	}
	nextBackoff(reason) {
		const initialBackoff =
			reason === "client"
				? 100
				: reason === "Unknown"
					? this.defaultInitialBackoff
					: serverDisconnectErrors[reason].timeout;
		const baseBackoff = initialBackoff * Math.pow(2, this.retries);
		this.retries += 1;
		const actualBackoff = Math.min(baseBackoff, this.maxBackoff);
		const jitter = actualBackoff * (Math.random() - 0.5);
		return actualBackoff + jitter;
	}
	reportLargeTransition({ transition, messageLength }) {
		if (
			transition.clientClockSkew === void 0 ||
			transition.serverTs === void 0
		) {
			return;
		}
		const transitionTransitTime =
			monotonicMillis() - // client time now
			// clientClockSkew = (server time + upstream latency) - client time
			// clientClockSkew is "how many milliseconds behind (slow) is the client clock"
			// but the latency of the Connect message inflates this, making it appear further behind
			transition.clientClockSkew -
			transition.serverTs / 1e6;
		const prettyTransitionTime = `${Math.round(transitionTransitTime)}ms`;
		const prettyMessageMB = `${Math.round(messageLength / 1e4) / 100}MB`;
		const bytesPerSecond = messageLength / (transitionTransitTime / 1e3);
		const prettyBytesPerSecond = `${Math.round(bytesPerSecond / 1e4) / 100}MB per second`;
		this._logVerbose(
			`received ${prettyMessageMB} transition in ${prettyTransitionTime} at ${prettyBytesPerSecond}`,
		);
		if (messageLength > 2e7) {
			this.logger.log(
				`received query results totaling more that 20MB (${prettyMessageMB}) which will take a long time to download on slower connections`,
			);
		} else if (transitionTransitTime > 2e4) {
			this.logger.log(
				`received query results totaling ${prettyMessageMB} which took more than 20s to arrive (${prettyTransitionTime})`,
			);
		}
		if (this.debug) {
			this.sendMessage({
				type: "Event",
				eventType: "ClientReceivedTransition",
				event: { transitionTransitTime, messageLength },
			});
		}
	}
};

// node_modules/convex/dist/esm/browser/sync/session.js
function newSessionId() {
	return uuidv4();
}
function uuidv4() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0,
			v2 = c === "x" ? r : (r & 3) | 8;
		return v2.toString(16);
	});
}

// node_modules/convex/dist/esm/vendor/jwt-decode/index.js
var InvalidTokenError = class extends Error {};
InvalidTokenError.prototype.name = "InvalidTokenError";
function b64DecodeUnicode(str) {
	return decodeURIComponent(
		atob(str).replace(/(.)/g, (_m, p) => {
			let code2 = p.charCodeAt(0).toString(16).toUpperCase();
			if (code2.length < 2) {
				code2 = "0" + code2;
			}
			return "%" + code2;
		}),
	);
}
function base64UrlDecode(str) {
	let output = str.replace(/-/g, "+").replace(/_/g, "/");
	switch (output.length % 4) {
		case 0:
			break;
		case 2:
			output += "==";
			break;
		case 3:
			output += "=";
			break;
		default:
			throw new Error("base64 string is not of the correct length");
	}
	try {
		return b64DecodeUnicode(output);
	} catch {
		return atob(output);
	}
}
function jwtDecode(token, options3) {
	if (typeof token !== "string") {
		throw new InvalidTokenError("Invalid token specified: must be a string");
	}
	options3 || (options3 = {});
	const pos = options3.header === true ? 0 : 1;
	const part = token.split(".")[pos];
	if (typeof part !== "string") {
		throw new InvalidTokenError(
			`Invalid token specified: missing part #${pos + 1}`,
		);
	}
	let decoded;
	try {
		decoded = base64UrlDecode(part);
	} catch (e) {
		throw new InvalidTokenError(
			`Invalid token specified: invalid base64 for part #${pos + 1} (${e.message})`,
		);
	}
	try {
		return JSON.parse(decoded);
	} catch (e) {
		throw new InvalidTokenError(
			`Invalid token specified: invalid json for part #${pos + 1} (${e.message})`,
		);
	}
}

// node_modules/convex/dist/esm/browser/sync/authentication_manager.js
var __defProp11 = Object.defineProperty;
var __defNormalProp10 = (obj, key, value) =>
	key in obj
		? __defProp11(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField10 = (obj, key, value) =>
	__defNormalProp10(obj, typeof key !== "symbol" ? key + "" : key, value);
var MAXIMUM_REFRESH_DELAY = 20 * 24 * 60 * 60 * 1e3;
var MAX_TOKEN_CONFIRMATION_ATTEMPTS = 2;
var AuthenticationManager = class {
	constructor(syncState, callbacks, config) {
		__publicField10(this, "authState", { state: "noAuth" });
		__publicField10(this, "configVersion", 0);
		__publicField10(this, "syncState");
		__publicField10(this, "authenticate");
		__publicField10(this, "stopSocket");
		__publicField10(this, "tryRestartSocket");
		__publicField10(this, "pauseSocket");
		__publicField10(this, "resumeSocket");
		__publicField10(this, "clearAuth");
		__publicField10(this, "logger");
		__publicField10(this, "refreshTokenLeewaySeconds");
		__publicField10(this, "initialAuthTokenReuse");
		__publicField10(this, "lastRefreshChange");
		__publicField10(this, "tokenConfirmationAttempts", 0);
		this.syncState = syncState;
		this.authenticate = callbacks.authenticate;
		this.stopSocket = callbacks.stopSocket;
		this.tryRestartSocket = callbacks.tryRestartSocket;
		this.pauseSocket = callbacks.pauseSocket;
		this.resumeSocket = callbacks.resumeSocket;
		this.clearAuth = callbacks.clearAuth;
		this.logger = config.logger;
		this.refreshTokenLeewaySeconds = config.refreshTokenLeewaySeconds;
		this.initialAuthTokenReuse = config.initialAuthTokenReuse;
		this.lastRefreshChange = false;
	}
	notifyRefreshChange(isRefreshing) {
		if (
			this.authState.state !== "noAuth" &&
			this.authState.state !== "initialRefetch" &&
			this.authState.config.onRefreshChange &&
			this.lastRefreshChange !== isRefreshing
		) {
			this.lastRefreshChange = isRefreshing;
			this.authState.config.onRefreshChange(isRefreshing);
		}
	}
	async setConfig(fetchToken, onChange, onRefreshChange) {
		this.resetAuthState();
		this._logVerbose("pausing WS for auth token fetch");
		this.pauseSocket();
		const token = await this.fetchTokenAndGuardAgainstRace(fetchToken, {
			forceRefreshToken: false,
		});
		if (token.isFromOutdatedConfig) {
			return;
		}
		const config = {
			fetchToken,
			onAuthChange: onChange,
			onRefreshChange,
		};
		if (token.value) {
			this.setAuthState({
				state: "waitingForServerConfirmationOfCachedToken",
				config,
				hasRetried: false,
			});
			this.authenticate(token.value);
		} else {
			this.setAuthState({
				state: "initialRefetch",
				config,
			});
			await this.refetchToken();
		}
		this._logVerbose("resuming WS after auth token fetch");
		this.resumeSocket();
	}
	onTransition(serverMessage) {
		if (
			!this.syncState.isCurrentOrNewerAuthVersion(
				serverMessage.endVersion.identity,
			)
		) {
			return;
		}
		if (
			serverMessage.endVersion.identity <= serverMessage.startVersion.identity
		) {
			return;
		}
		this._logVerbose(
			`auth state is ${this.authState.state} when handling transition`,
		);
		this.syncState.markAuthCompletion();
		if (this.authState.state === "waitingForServerConfirmationOfCachedToken") {
			this._logVerbose("server confirmed auth token is valid");
			const cachedToken = this.syncState.getAuth()?.value;
			if (this.initialAuthTokenReuse && cachedToken) {
				this.scheduleTokenRefetch(cachedToken, serverMessage.clientClockSkew);
			} else {
				void this.refetchToken();
			}
			this.authState.config.onAuthChange(true);
			return;
		}
		if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
			this._logVerbose("server confirmed new auth token is valid");
			this.notifyRefreshChange(false);
			this.scheduleTokenRefetch(this.authState.token);
			this.tokenConfirmationAttempts = 0;
			if (!this.authState.hadAuth) {
				this.authState.config.onAuthChange(true);
			}
		}
	}
	onAuthError(serverMessage) {
		if (
			serverMessage.authUpdateAttempted === false &&
			(this.authState.state === "waitingForServerConfirmationOfFreshToken" ||
				this.authState.state === "waitingForServerConfirmationOfCachedToken")
		) {
			this._logVerbose("ignoring non-auth token expired error");
			return;
		}
		const { baseVersion } = serverMessage;
		if (!this.syncState.isCurrentOrNewerAuthVersion(baseVersion + 1)) {
			this._logVerbose("ignoring auth error for previous auth attempt");
			return;
		}
		void this.tryToReauthenticate(serverMessage);
		return;
	}
	// This is similar to `refetchToken` defined below, in fact we
	// don't represent them as different states, but it is different
	// in that we pause the WebSocket so that mutations
	// don't retry with bad auth.
	async tryToReauthenticate(serverMessage) {
		this._logVerbose(`attempting to reauthenticate: ${serverMessage.error}`);
		if (
			// No way to fetch another token, kaboom
			this.authState.state === "noAuth" || // We failed on a fresh token. After a small number of retries, we give up
			// and clear the auth state to avoid infinite retries.
			(this.authState.state === "waitingForServerConfirmationOfFreshToken" &&
				this.tokenConfirmationAttempts >= MAX_TOKEN_CONFIRMATION_ATTEMPTS)
		) {
			this.logger.error(
				`Failed to authenticate: "${serverMessage.error}", check your server auth config`,
			);
			if (this.syncState.hasAuth()) {
				this.syncState.clearAuth();
			}
			if (this.authState.state !== "noAuth") {
				this.setAndReportAuthFailed(this.authState.config.onAuthChange);
			}
			return;
		}
		if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
			this.tokenConfirmationAttempts++;
			this._logVerbose(
				`retrying reauthentication, ${MAX_TOKEN_CONFIRMATION_ATTEMPTS - this.tokenConfirmationAttempts} attempts remaining`,
			);
		}
		this.notifyRefreshChange(true);
		await this.stopSocket();
		if (this.authState.state === "noAuth") {
			return;
		}
		const token = await this.fetchTokenAndGuardAgainstRace(
			this.authState.config.fetchToken,
			{
				forceRefreshToken: true,
			},
		);
		if (token.isFromOutdatedConfig) {
			return;
		}
		if (token.value && this.syncState.isNewAuth(token.value)) {
			this.authenticate(token.value);
			this.setAuthState({
				state: "waitingForServerConfirmationOfFreshToken",
				config: this.authState.config,
				token: token.value,
				hadAuth:
					this.authState.state === "notRefetching" ||
					this.authState.state === "waitingForScheduledRefetch",
			});
		} else {
			this._logVerbose("reauthentication failed, could not fetch a new token");
			if (this.syncState.hasAuth()) {
				this.syncState.clearAuth();
			}
			this.setAndReportAuthFailed(this.authState.config.onAuthChange);
		}
		this.tryRestartSocket();
	}
	// Force refetch the token and schedule another refetch
	// before the token expires - an active client should never
	// need to reauthenticate.
	async refetchToken() {
		if (this.authState.state === "noAuth") {
			return;
		}
		this._logVerbose("refetching auth token");
		const token = await this.fetchTokenAndGuardAgainstRace(
			this.authState.config.fetchToken,
			{
				forceRefreshToken: true,
			},
		);
		if (token.isFromOutdatedConfig) {
			return;
		}
		if (token.value) {
			if (this.syncState.isNewAuth(token.value)) {
				this.setAuthState({
					state: "waitingForServerConfirmationOfFreshToken",
					hadAuth: this.syncState.hasAuth(),
					token: token.value,
					config: this.authState.config,
				});
				this.authenticate(token.value);
			} else {
				this.setAuthState({
					state: "notRefetching",
					config: this.authState.config,
				});
			}
		} else {
			this._logVerbose("refetching token failed");
			if (this.syncState.hasAuth()) {
				this.clearAuth();
			}
			this.setAndReportAuthFailed(this.authState.config.onAuthChange);
		}
		this._logVerbose(
			"restarting WS after auth token fetch (if currently stopped)",
		);
		this.tryRestartSocket();
	}
	scheduleTokenRefetch(token, clientClockSkewMs) {
		if (this.authState.state === "noAuth") {
			return;
		}
		const decodedToken = this.decodeToken(token);
		if (!decodedToken) {
			this.logger.error(
				"Auth token is not a valid JWT, cannot refetch the token",
			);
			return;
		}
		const { iat, exp } = decodedToken;
		if (!iat || !exp) {
			this.logger.error(
				"Auth token does not have required fields, cannot refetch the token",
			);
			return;
		}
		const fullLifetimeSeconds = exp - iat;
		if (fullLifetimeSeconds <= 2) {
			this.logger.error(
				"Auth token does not live long enough, cannot refetch the token",
			);
			return;
		}
		let tokenValiditySeconds;
		if (clientClockSkewMs !== void 0) {
			const estimatedServerNowSeconds = (Date.now() - clientClockSkewMs) / 1e3;
			tokenValiditySeconds = exp - estimatedServerNowSeconds;
			if (tokenValiditySeconds <= 0) {
				tokenValiditySeconds = 0;
			}
		} else {
			tokenValiditySeconds = fullLifetimeSeconds;
		}
		let delay = Math.min(
			MAXIMUM_REFRESH_DELAY,
			(tokenValiditySeconds - this.refreshTokenLeewaySeconds) * 1e3,
		);
		if (delay <= 0) {
			this.logger.warn(
				`Refetching auth token immediately, configured leeway ${this.refreshTokenLeewaySeconds}s is larger than the token's lifetime ${tokenValiditySeconds}s`,
			);
			delay = 0;
		}
		const refetchTokenTimeoutId = setTimeout(() => {
			this._logVerbose("running scheduled token refetch");
			void this.refetchToken();
		}, delay);
		this.setAuthState({
			state: "waitingForScheduledRefetch",
			refetchTokenTimeoutId,
			config: this.authState.config,
		});
		this._logVerbose(
			`scheduled preemptive auth token refetching in ${delay}ms`,
		);
	}
	// Protects against simultaneous calls to `setConfig`
	// while we're fetching a token
	async fetchTokenAndGuardAgainstRace(fetchToken, fetchArgs) {
		const originalConfigVersion = ++this.configVersion;
		this._logVerbose(
			`fetching token with config version ${originalConfigVersion}`,
		);
		const token = await fetchToken(fetchArgs);
		if (this.configVersion !== originalConfigVersion) {
			this._logVerbose(
				`stale config version, expected ${originalConfigVersion}, got ${this.configVersion}`,
			);
			return { isFromOutdatedConfig: true };
		}
		return { isFromOutdatedConfig: false, value: token };
	}
	stop() {
		this.resetAuthState();
		this.configVersion++;
		this._logVerbose(`config version bumped to ${this.configVersion}`);
	}
	setAndReportAuthFailed(onAuthChange) {
		onAuthChange(false);
		this.resetAuthState();
	}
	// The sole path to `state === "noAuth"`; consumers rely on this firing
	// `notifyRefreshChange(false)` to pair any in-flight `(true)`. May run
	// when refresh state is already false.
	resetAuthState() {
		this.notifyRefreshChange(false);
		this.setAuthState({ state: "noAuth" });
	}
	setAuthState(newAuth) {
		const authStateForLog =
			newAuth.state === "waitingForServerConfirmationOfFreshToken"
				? {
						hadAuth: newAuth.hadAuth,
						state: newAuth.state,
						token: `...${newAuth.token.slice(-7)}`,
					}
				: { state: newAuth.state };
		this._logVerbose(
			`setting auth state to ${JSON.stringify(authStateForLog)}`,
		);
		switch (newAuth.state) {
			case "waitingForScheduledRefetch":
			case "notRefetching":
			case "noAuth":
				this.tokenConfirmationAttempts = 0;
				break;
			case "waitingForServerConfirmationOfFreshToken":
			case "waitingForServerConfirmationOfCachedToken":
			case "initialRefetch":
				break;
			default: {
				newAuth;
			}
		}
		if (this.authState.state === "waitingForScheduledRefetch") {
			clearTimeout(this.authState.refetchTokenTimeoutId);
		}
		this.authState = newAuth;
	}
	decodeToken(token) {
		try {
			return jwtDecode(token);
		} catch (e) {
			this._logVerbose(
				`Error decoding token: ${e instanceof Error ? e.message : "Unknown error"}`,
			);
			return null;
		}
	}
	_logVerbose(message) {
		this.logger.logVerbose(`${message} [v${this.configVersion}]`);
	}
};

// node_modules/convex/dist/esm/browser/sync/metrics.js
var markNames = [
	"convexClientConstructed",
	"convexWebSocketOpen",
	"convexFirstMessageReceived",
];
function mark(name, sessionId) {
	const detail = { sessionId };
	if (typeof performance === "undefined" || !performance.mark) return;
	performance.mark(name, { detail });
}
function performanceMarkToJson(mark2) {
	let name = mark2.name.slice("convex".length);
	name = name.charAt(0).toLowerCase() + name.slice(1);
	return {
		name,
		startTime: mark2.startTime,
	};
}
function getMarksReport(sessionId) {
	if (typeof performance === "undefined" || !performance.getEntriesByName) {
		return [];
	}
	const allMarks = [];
	for (const name of markNames) {
		const marks = performance
			.getEntriesByName(name)
			.filter((entry) => entry.entryType === "mark")
			.filter((mark2) => mark2.detail.sessionId === sessionId);
		allMarks.push(...marks);
	}
	return allMarks.map(performanceMarkToJson);
}

// node_modules/convex/dist/esm/browser/sync/client.js
var __defProp12 = Object.defineProperty;
var __defNormalProp11 = (obj, key, value) =>
	key in obj
		? __defProp12(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField11 = (obj, key, value) =>
	__defNormalProp11(obj, typeof key !== "symbol" ? key + "" : key, value);
var BaseConvexClient = class {
	/**
	 * @param address - The url of your Convex deployment, often provided
	 * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
	 * @param onTransition - A callback receiving an array of query tokens
	 * corresponding to query results that have changed -- additional handlers
	 * can be added via `addOnTransitionHandler`.
	 * @param options - See {@link BaseConvexClientOptions} for a full description.
	 */
	constructor(address, onTransition, options3) {
		__publicField11(this, "address");
		__publicField11(this, "state");
		__publicField11(this, "requestManager");
		__publicField11(this, "webSocketManager");
		__publicField11(this, "authenticationManager");
		__publicField11(this, "remoteQuerySet");
		__publicField11(this, "optimisticQueryResults");
		__publicField11(this, "_transitionHandlerCounter", 0);
		__publicField11(this, "_nextRequestId");
		__publicField11(this, "_onTransitionFns", /* @__PURE__ */ new Map());
		__publicField11(this, "_sessionId");
		__publicField11(this, "firstMessageReceived", false);
		__publicField11(this, "debug");
		__publicField11(this, "logger");
		__publicField11(this, "maxObservedTimestamp");
		__publicField11(
			this,
			"connectionStateSubscribers",
			/* @__PURE__ */ new Map(),
		);
		__publicField11(this, "nextConnectionStateSubscriberId", 0);
		__publicField11(this, "_lastPublishedConnectionState");
		__publicField11(this, "markConnectionStateDirty", () => {
			void Promise.resolve().then(() => {
				const curConnectionState = this.connectionState();
				if (
					JSON.stringify(curConnectionState) !==
					JSON.stringify(this._lastPublishedConnectionState)
				) {
					this._lastPublishedConnectionState = curConnectionState;
					for (const cb of this.connectionStateSubscribers.values()) {
						cb(curConnectionState);
					}
				}
			});
		});
		__publicField11(this, "mark", (name) => {
			if (this.debug) {
				mark(name, this.sessionId);
			}
		});
		if (typeof address === "object") {
			throw new Error(
				"Passing a ClientConfig object is no longer supported. Pass the URL of the Convex deployment as a string directly.",
			);
		}
		if (options3?.skipConvexDeploymentUrlCheck !== true) {
			validateDeploymentUrl(address);
		}
		options3 = { ...options3 };
		const authRefreshTokenLeewaySeconds =
			options3.authRefreshTokenLeewaySeconds ?? 10;
		let webSocketConstructor = options3.webSocketConstructor;
		if (!webSocketConstructor && typeof WebSocket === "undefined") {
			throw new Error(
				"No WebSocket global variable defined! To use Convex in an environment without WebSocket try the HTTP client: https://docs.convex.dev/api/classes/browser.ConvexHttpClient",
			);
		}
		webSocketConstructor = webSocketConstructor || WebSocket;
		this.debug = options3.reportDebugInfoToConvex ?? false;
		this.address = address;
		this.logger =
			options3.logger === false
				? instantiateNoopLogger({ verbose: options3.verbose ?? false })
				: options3.logger !== true && options3.logger
					? options3.logger
					: instantiateDefaultLogger({ verbose: options3.verbose ?? false });
		const i3 = address.search("://");
		if (i3 === -1) {
			throw new Error("Provided address was not an absolute URL.");
		}
		const origin = address.substring(i3 + 3);
		const protocol = address.substring(0, i3);
		let wsProtocol;
		if (protocol === "http") {
			wsProtocol = "ws";
		} else if (protocol === "https") {
			wsProtocol = "wss";
		} else {
			throw new Error(`Unknown parent protocol ${protocol}`);
		}
		const wsUri = `${wsProtocol}://${origin}/api/${version2}/sync`;
		this.state = new LocalSyncState();
		this.remoteQuerySet = new RemoteQuerySet(
			(queryId) => this.state.queryPath(queryId),
			this.logger,
		);
		this.requestManager = new RequestManager(
			this.logger,
			this.markConnectionStateDirty,
		);
		const pauseSocket = () => {
			this.webSocketManager.pause();
			this.state.pause();
		};
		this.authenticationManager = new AuthenticationManager(
			this.state,
			{
				authenticate: (token) => {
					const message = this.state.setAuth(token);
					this.webSocketManager.sendMessage(message);
					return message.baseVersion;
				},
				stopSocket: () => this.webSocketManager.stop(),
				tryRestartSocket: () => this.webSocketManager.tryRestart(),
				pauseSocket,
				resumeSocket: () => this.webSocketManager.resume(),
				clearAuth: () => {
					this.clearAuth();
				},
			},
			{
				logger: this.logger,
				refreshTokenLeewaySeconds: authRefreshTokenLeewaySeconds,
				initialAuthTokenReuse: options3.initialAuthTokenReuse ?? false,
			},
		);
		this.optimisticQueryResults = new OptimisticQueryResults();
		this.addOnTransitionHandler((transition) => {
			onTransition(transition.queries.map((q) => q.token));
		});
		this._nextRequestId = 0;
		this._sessionId = newSessionId();
		const { unsavedChangesWarning } = options3;
		if (
			typeof window === "undefined" ||
			typeof window.addEventListener === "undefined"
		) {
			if (unsavedChangesWarning === true) {
				throw new Error(
					"unsavedChangesWarning requested, but window.addEventListener not found! Remove {unsavedChangesWarning: true} from Convex client options.",
				);
			}
		} else if (unsavedChangesWarning !== false) {
			window.addEventListener("beforeunload", (e) => {
				if (this.requestManager.hasIncompleteRequests()) {
					e.preventDefault();
					const confirmationMessage =
						"Are you sure you want to leave? Your changes may not be saved.";
					(e || window.event).returnValue = confirmationMessage;
					return confirmationMessage;
				}
			});
		}
		this.webSocketManager = new WebSocketManager(
			wsUri,
			{
				onOpen: (reconnectMetadata) => {
					this.mark("convexWebSocketOpen");
					this.webSocketManager.sendMessage({
						...reconnectMetadata,
						type: "Connect",
						sessionId: this._sessionId,
						maxObservedTimestamp: this.maxObservedTimestamp,
					});
					this.remoteQuerySet = new RemoteQuerySet(
						(queryId) => this.state.queryPath(queryId),
						this.logger,
					);
					const [querySetModification, authModification] = this.state.restart();
					if (authModification) {
						this.webSocketManager.sendMessage(authModification);
					}
					this.webSocketManager.sendMessage(querySetModification);
					for (const message of this.requestManager.restart()) {
						this.webSocketManager.sendMessage(message);
					}
				},
				onResume: () => {
					const [querySetModification, authModification] = this.state.resume();
					if (authModification) {
						this.webSocketManager.sendMessage(authModification);
					}
					if (querySetModification) {
						this.webSocketManager.sendMessage(querySetModification);
					}
					for (const message of this.requestManager.resume()) {
						this.webSocketManager.sendMessage(message);
					}
				},
				onMessage: (serverMessage) => {
					if (!this.firstMessageReceived) {
						this.firstMessageReceived = true;
						this.mark("convexFirstMessageReceived");
						this.reportMarks();
					}
					switch (serverMessage.type) {
						case "Transition": {
							this.observedTimestamp(serverMessage.endVersion.ts);
							this.authenticationManager.onTransition(serverMessage);
							this.remoteQuerySet.transition(serverMessage);
							this.state.transition(serverMessage);
							const completedRequests = this.requestManager.removeCompleted(
								this.remoteQuerySet.timestamp(),
							);
							this.notifyOnQueryResultChanges(completedRequests);
							break;
						}
						case "MutationResponse": {
							if (serverMessage.success) {
								this.observedTimestamp(serverMessage.ts);
							}
							const completedMutationInfo =
								this.requestManager.onResponse(serverMessage);
							if (completedMutationInfo !== null) {
								this.notifyOnQueryResultChanges(
									/* @__PURE__ */ new Map([
										[
											completedMutationInfo.requestId,
											completedMutationInfo.result,
										],
									]),
								);
							}
							break;
						}
						case "ActionResponse": {
							this.requestManager.onResponse(serverMessage);
							break;
						}
						case "AuthError": {
							this.authenticationManager.onAuthError(serverMessage);
							break;
						}
						case "FatalError": {
							const error = logFatalError(this.logger, serverMessage.error);
							void this.webSocketManager.terminate();
							throw error;
						}
						default: {
							serverMessage;
						}
					}
					return {
						hasSyncedPastLastReconnect: this.hasSyncedPastLastReconnect(),
					};
				},
				onServerDisconnectError: options3.onServerDisconnectError,
			},
			webSocketConstructor,
			this.logger,
			this.markConnectionStateDirty,
			this.debug,
		);
		this.mark("convexClientConstructed");
		if (options3.expectAuth) {
			pauseSocket();
		}
	}
	/**
	 * Return true if there is outstanding work from prior to the time of the most recent restart.
	 * This indicates that the client has not proven itself to have gotten past the issue that
	 * potentially led to the restart. Use this to influence when to reset backoff after a failure.
	 */
	hasSyncedPastLastReconnect() {
		const hasSyncedPastLastReconnect =
			this.requestManager.hasSyncedPastLastReconnect() &&
			this.state.hasSyncedPastLastReconnect();
		return hasSyncedPastLastReconnect;
	}
	observedTimestamp(observedTs) {
		if (
			this.maxObservedTimestamp === void 0 ||
			this.maxObservedTimestamp.lessThanOrEqual(observedTs)
		) {
			this.maxObservedTimestamp = observedTs;
		}
	}
	getMaxObservedTimestamp() {
		return this.maxObservedTimestamp;
	}
	/**
	 * Compute the current query results based on the remoteQuerySet and the
	 * current optimistic updates and call `onTransition` for all the changed
	 * queries.
	 *
	 * @param completedMutations - A set of mutation IDs whose optimistic updates
	 * are no longer needed.
	 */
	notifyOnQueryResultChanges(completedRequests) {
		const remoteQueryResults = this.remoteQuerySet.remoteQueryResults();
		const queryTokenToValue = /* @__PURE__ */ new Map();
		for (const [queryId, result2] of remoteQueryResults) {
			const queryToken = this.state.queryToken(queryId);
			if (queryToken !== null) {
				const query = {
					result: result2,
					udfPath: this.state.queryPath(queryId),
					args: this.state.queryArgs(queryId),
				};
				queryTokenToValue.set(queryToken, query);
			}
		}
		const changedQueryTokens =
			this.optimisticQueryResults.ingestQueryResultsFromServer(
				queryTokenToValue,
				new Set(completedRequests.keys()),
			);
		this.handleTransition({
			queries: changedQueryTokens.map((token) => {
				const optimisticResult =
					this.optimisticQueryResults.rawQueryResult(token);
				return {
					token,
					modification: {
						kind: "Updated",
						result: optimisticResult,
					},
				};
			}),
			reflectedMutations: Array.from(completedRequests).map(
				([requestId, result2]) => ({
					requestId,
					result: result2,
				}),
			),
			timestamp: this.remoteQuerySet.timestamp(),
		});
	}
	handleTransition(transition) {
		for (const fn of this._onTransitionFns.values()) {
			fn(transition);
		}
	}
	/**
	 * Add a handler that will be called on a transition.
	 *
	 * Any external side effects (e.g. setting React state) should be handled here.
	 *
	 * @param fn
	 *
	 * @returns
	 */
	addOnTransitionHandler(fn) {
		const id = this._transitionHandlerCounter++;
		this._onTransitionFns.set(id, fn);
		return () => this._onTransitionFns.delete(id);
	}
	/**
	 * Get the current JWT auth token and decoded claims.
	 */
	getCurrentAuthClaims() {
		const authToken = this.state.getAuth();
		let decoded = {};
		if (authToken && authToken.tokenType === "User") {
			try {
				decoded = authToken ? jwtDecode(authToken.value) : {};
			} catch {
				decoded = {};
			}
		} else {
			return void 0;
		}
		return { token: authToken.value, decoded };
	}
	/**
	 * Set the authentication token to be used for subsequent queries and mutations.
	 * `fetchToken` will be called automatically again if a token expires.
	 * `fetchToken` should return `null` if the token cannot be retrieved, for example
	 * when the user's rights were permanently revoked.
	 * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
	 * @param onChange - a callback that will be called when the authentication status changes
	 * @param onRefreshChange - a callback called with `true` when the socket is paused to fetch a replacement token after a server rejection, and `false` when refresh completes
	 */
	setAuth(fetchToken, onChange, onRefreshChange) {
		void this.authenticationManager.setConfig(
			fetchToken,
			onChange,
			onRefreshChange,
		);
	}
	hasAuth() {
		return this.state.hasAuth();
	}
	/** @internal */
	setAdminAuth(value, fakeUserIdentity) {
		const message = this.state.setAdminAuth(value, fakeUserIdentity);
		this.webSocketManager.sendMessage(message);
	}
	clearAuth() {
		const message = this.state.clearAuth();
		this.webSocketManager.sendMessage(message);
	}
	/**
     * Subscribe to a query function.
     *
     * Whenever this query's result changes, the `onTransition` callback
     * passed into the constructor will be called.
     *
     * @param name - The name of the query.
     * @param args - An arguments object for the query. If this is omitted, the
     * arguments will be `{}`.
     * @param options - A {@link SubscribeOptions} options object for this query.

     * @returns An object containing a {@link QueryToken} corresponding to this
     * query and an `unsubscribe` callback.
     */
	subscribe(name, args, options3) {
		const argsObject = parseArgs(args);
		const { modification, queryToken, unsubscribe } = this.state.subscribe(
			name,
			argsObject,
			options3?.journal,
			options3?.componentPath,
		);
		if (modification !== null) {
			this.webSocketManager.sendMessage(modification);
		}
		return {
			queryToken,
			unsubscribe: () => {
				const modification2 = unsubscribe();
				if (modification2) {
					this.webSocketManager.sendMessage(modification2);
				}
			},
		};
	}
	/**
	 * A query result based only on the current, local state.
	 *
	 * The only way this will return a value is if we're already subscribed to the
	 * query or its value has been set optimistically.
	 */
	localQueryResult(udfPath, args) {
		const argsObject = parseArgs(args);
		const queryToken = serializePathAndArgs(udfPath, argsObject);
		return this.optimisticQueryResults.queryResult(queryToken);
	}
	/**
	 * Get query result by query token based on current, local state
	 *
	 * The only way this will return a value is if we're already subscribed to the
	 * query or its value has been set optimistically.
	 *
	 * @internal
	 */
	localQueryResultByToken(queryToken) {
		return this.optimisticQueryResults.queryResult(queryToken);
	}
	/**
	 * Whether local query result is available for a token.
	 *
	 * This method does not throw if the result is an error.
	 *
	 * @internal
	 */
	hasLocalQueryResultByToken(queryToken) {
		return this.optimisticQueryResults.hasQueryResult(queryToken);
	}
	/**
	 * @internal
	 */
	localQueryLogs(udfPath, args) {
		const argsObject = parseArgs(args);
		const queryToken = serializePathAndArgs(udfPath, argsObject);
		return this.optimisticQueryResults.queryLogs(queryToken);
	}
	/**
	 * Retrieve the current {@link QueryJournal} for this query function.
	 *
	 * If we have not yet received a result for this query, this will be `undefined`.
	 *
	 * @param name - The name of the query.
	 * @param args - The arguments object for this query.
	 * @returns The query's {@link QueryJournal} or `undefined`.
	 */
	queryJournal(name, args) {
		const argsObject = parseArgs(args);
		const queryToken = serializePathAndArgs(name, argsObject);
		return this.state.queryJournal(queryToken);
	}
	/**
	 * Get the current {@link ConnectionState} between the client and the Convex
	 * backend.
	 *
	 * @returns The {@link ConnectionState} with the Convex backend.
	 */
	connectionState() {
		const wsConnectionState = this.webSocketManager.connectionState();
		return {
			hasInflightRequests: this.requestManager.hasInflightRequests(),
			isWebSocketConnected: wsConnectionState.isConnected,
			hasEverConnected: wsConnectionState.hasEverConnected,
			connectionCount: wsConnectionState.connectionCount,
			connectionRetries: wsConnectionState.connectionRetries,
			timeOfOldestInflightRequest:
				this.requestManager.timeOfOldestInflightRequest(),
			inflightMutations: this.requestManager.inflightMutations(),
			inflightActions: this.requestManager.inflightActions(),
		};
	}
	/**
	 * Subscribe to the {@link ConnectionState} between the client and the Convex
	 * backend, calling a callback each time it changes.
	 *
	 * Subscribed callbacks will be called when any part of ConnectionState changes.
	 * ConnectionState may grow in future versions (e.g. to provide a array of
	 * inflight requests) in which case callbacks would be called more frequently.
	 *
	 * @returns An unsubscribe function to stop listening.
	 */
	subscribeToConnectionState(cb) {
		const id = this.nextConnectionStateSubscriberId++;
		this.connectionStateSubscribers.set(id, cb);
		return () => {
			this.connectionStateSubscribers.delete(id);
		};
	}
	/**
     * Execute a mutation function.
     *
     * @param name - The name of the mutation.
     * @param args - An arguments object for the mutation. If this is omitted,
     * the arguments will be `{}`.
     * @param options - A {@link MutationOptions} options object for this mutation.

     * @returns - A promise of the mutation's result.
     */
	async mutation(name, args, options3) {
		const result2 = await this.mutationInternal(name, args, options3);
		if (!result2.success) {
			if (result2.errorData !== void 0) {
				throw forwardData(
					result2,
					new ConvexError(
						createHybridErrorStacktrace("mutation", name, result2),
					),
				);
			}
			throw new Error(createHybridErrorStacktrace("mutation", name, result2));
		}
		return result2.value;
	}
	/**
	 * @internal
	 */
	async mutationInternal(udfPath, args, options3, componentPath) {
		const { mutationPromise } = this.enqueueMutation(
			udfPath,
			args,
			options3,
			componentPath,
		);
		return mutationPromise;
	}
	/**
	 * @internal
	 */
	enqueueMutation(udfPath, args, options3, componentPath) {
		const mutationArgs = parseArgs(args);
		this.tryReportLongDisconnect();
		const requestId = this.nextRequestId;
		this._nextRequestId++;
		if (options3 !== void 0) {
			const optimisticUpdate = options3.optimisticUpdate;
			if (optimisticUpdate !== void 0) {
				const wrappedUpdate = (localQueryStore) => {
					const result2 = optimisticUpdate(localQueryStore, mutationArgs);
					if (result2 instanceof Promise) {
						this.logger.warn(
							"Optimistic update handler returned a Promise. Optimistic updates should be synchronous.",
						);
					}
				};
				const changedQueryTokens =
					this.optimisticQueryResults.applyOptimisticUpdate(
						wrappedUpdate,
						requestId,
					);
				const changedQueries = changedQueryTokens.map((token) => {
					const localResult = this.localQueryResultByToken(token);
					return {
						token,
						modification: {
							kind: "Updated",
							result:
								localResult === void 0
									? void 0
									: {
											success: true,
											value: localResult,
											logLines: [],
										},
						},
					};
				});
				this.handleTransition({
					queries: changedQueries,
					reflectedMutations: [],
					timestamp: this.remoteQuerySet.timestamp(),
				});
			}
		}
		const message = {
			type: "Mutation",
			requestId,
			udfPath,
			componentPath,
			args: [convexToJson(mutationArgs)],
		};
		const mightBeSent = this.webSocketManager.sendMessage(message);
		const mutationPromise = this.requestManager.request(message, mightBeSent);
		return {
			requestId,
			mutationPromise,
		};
	}
	/**
	 * Execute an action function.
	 *
	 * @param name - The name of the action.
	 * @param args - An arguments object for the action. If this is omitted,
	 * the arguments will be `{}`.
	 * @returns A promise of the action's result.
	 */
	async action(name, args) {
		const result2 = await this.actionInternal(name, args);
		if (!result2.success) {
			if (result2.errorData !== void 0) {
				throw forwardData(
					result2,
					new ConvexError(createHybridErrorStacktrace("action", name, result2)),
				);
			}
			throw new Error(createHybridErrorStacktrace("action", name, result2));
		}
		return result2.value;
	}
	/**
	 * @internal
	 */
	async actionInternal(udfPath, args, componentPath) {
		const actionArgs = parseArgs(args);
		const requestId = this.nextRequestId;
		this._nextRequestId++;
		this.tryReportLongDisconnect();
		const message = {
			type: "Action",
			requestId,
			udfPath,
			componentPath,
			args: [convexToJson(actionArgs)],
		};
		const mightBeSent = this.webSocketManager.sendMessage(message);
		return this.requestManager.request(message, mightBeSent);
	}
	/**
	 * Close any network handles associated with this client and stop all subscriptions.
	 *
	 * Call this method when you're done with an {@link BaseConvexClient} to
	 * dispose of its sockets and resources.
	 *
	 * @returns A `Promise` fulfilled when the connection has been completely closed.
	 */
	async close() {
		this.authenticationManager.stop();
		return this.webSocketManager.terminate();
	}
	/**
	 * Return the address for this client, useful for creating a new client.
	 *
	 * Not guaranteed to match the address with which this client was constructed:
	 * it may be canonicalized.
	 */
	get url() {
		return this.address;
	}
	/**
	 * @internal
	 */
	get nextRequestId() {
		return this._nextRequestId;
	}
	/**
	 * @internal
	 */
	get sessionId() {
		return this._sessionId;
	}
	/**
	 * Reports performance marks to the server. This should only be called when
	 * we have a functional websocket.
	 */
	reportMarks() {
		if (this.debug) {
			const report = getMarksReport(this.sessionId);
			this.webSocketManager.sendMessage({
				type: "Event",
				eventType: "ClientConnect",
				event: report,
			});
		}
	}
	tryReportLongDisconnect() {
		if (!this.debug) {
			return;
		}
		const timeOfOldestRequest =
			this.connectionState().timeOfOldestInflightRequest;
		if (
			timeOfOldestRequest === null ||
			Date.now() - timeOfOldestRequest.getTime() <= 60 * 1e3
		) {
			return;
		}
		const endpoint = `${this.address}/api/debug_event`;
		fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Convex-Client": `npm-${version2}`,
			},
			body: JSON.stringify({ event: "LongWebsocketDisconnect" }),
		})
			.then((response) => {
				if (!response.ok) {
					this.logger.warn(
						"Analytics request failed with response:",
						response.body,
					);
				}
			})
			.catch((error) => {
				this.logger.warn("Analytics response failed with error:", error);
			});
	}
};

// node_modules/convex/dist/esm/browser/sync/pagination.js
function asPaginationResult(value) {
	if (
		typeof value !== "object" ||
		value === null ||
		!Array.isArray(value.page) ||
		typeof value.isDone !== "boolean" ||
		typeof value.continueCursor !== "string"
	) {
		throw new Error(`Not a valid paginated query result: ${value?.toString()}`);
	}
	return value;
}

// node_modules/convex/dist/esm/browser/sync/paginated_query_client.js
var __defProp13 = Object.defineProperty;
var __defNormalProp12 = (obj, key, value) =>
	key in obj
		? __defProp13(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField12 = (obj, key, value) =>
	__defNormalProp12(obj, typeof key !== "symbol" ? key + "" : key, value);
var PaginatedQueryClient = class {
	constructor(client, onTransition) {
		this.client = client;
		this.onTransition = onTransition;
		__publicField12(this, "paginatedQuerySet", /* @__PURE__ */ new Map());
		__publicField12(this, "lastTransitionTs");
		this.lastTransitionTs = Long.fromNumber(0);
		this.client.addOnTransitionHandler((transition) =>
			this.onBaseTransition(transition),
		);
	}
	/**
	 * Subscribe to a paginated query.
	 *
	 * @param name - The name of the paginated query function
	 * @param args - Arguments for the query (excluding paginationOpts)
	 * @param options - Pagination options including initialNumItems
	 * @returns Object with paginatedQueryToken and unsubscribe function
	 */
	subscribe(name, args, options3) {
		const canonicalizedUdfPath = canonicalizeUdfPath(name);
		const token = serializePaginatedPathAndArgs(
			canonicalizedUdfPath,
			args,
			options3,
		);
		const unsubscribe = () => this.removePaginatedQuerySubscriber(token);
		const existingEntry = this.paginatedQuerySet.get(token);
		if (existingEntry) {
			existingEntry.numSubscribers += 1;
			return {
				paginatedQueryToken: token,
				unsubscribe,
			};
		}
		this.paginatedQuerySet.set(token, {
			token,
			canonicalizedUdfPath,
			args,
			numSubscribers: 1,
			options: { initialNumItems: options3.initialNumItems },
			nextPageKey: 0,
			pageKeys: [],
			pageKeyToQuery: /* @__PURE__ */ new Map(),
			ongoingSplits: /* @__PURE__ */ new Map(),
			skip: false,
			id: options3.id,
		});
		this.addPageToPaginatedQuery(token, null, options3.initialNumItems);
		return {
			paginatedQueryToken: token,
			unsubscribe,
		};
	}
	/**
	 * Get current results for a paginated query based on local state.
	 *
	 * Throws an error when one of the pages has errored.
	 */
	localQueryResult(name, args, options3) {
		const canonicalizedUdfPath = canonicalizeUdfPath(name);
		const token = serializePaginatedPathAndArgs(
			canonicalizedUdfPath,
			args,
			options3,
		);
		return this.localQueryResultByToken(token);
	}
	/**
	 * @internal
	 */
	localQueryResultByToken(token) {
		const paginatedQuery = this.paginatedQuerySet.get(token);
		if (!paginatedQuery) {
			return void 0;
		}
		const activePages = this.activePageQueryTokens(paginatedQuery);
		if (activePages.length === 0) {
			return {
				results: [],
				status: "LoadingFirstPage",
				loadMore: (numItems) => {
					return this.loadMoreOfPaginatedQuery(token, numItems);
				},
			};
		}
		let allResults = [];
		let hasUndefined = false;
		let isDone = false;
		for (const pageToken of activePages) {
			const result2 = this.client.localQueryResultByToken(pageToken);
			if (result2 === void 0) {
				hasUndefined = true;
				isDone = false;
				continue;
			}
			const paginationResult = asPaginationResult(result2);
			allResults = allResults.concat(paginationResult.page);
			isDone = !!paginationResult.isDone;
		}
		let status2;
		if (hasUndefined) {
			status2 = allResults.length === 0 ? "LoadingFirstPage" : "LoadingMore";
		} else if (isDone) {
			status2 = "Exhausted";
		} else {
			status2 = "CanLoadMore";
		}
		return {
			results: allResults,
			status: status2,
			loadMore: (numItems) => {
				return this.loadMoreOfPaginatedQuery(token, numItems);
			},
		};
	}
	onBaseTransition(transition) {
		const changedBaseTokens = transition.queries.map((q) => q.token);
		const changed = this.queriesContainingTokens(changedBaseTokens);
		let paginatedQueries = [];
		if (changed.length > 0) {
			this.processPaginatedQuerySplits(changed, (token) =>
				this.client.localQueryResultByToken(token),
			);
			paginatedQueries = changed.map((token) => ({
				token,
				modification: {
					kind: "Updated",
					result: this.localQueryResultByToken(token),
				},
			}));
		}
		const extendedTransition = {
			...transition,
			paginatedQueries,
		};
		this.onTransition(extendedTransition);
	}
	/**
	 * Load more items for a paginated query.
	 *
	 * This *always* causes a transition, the status of the query
	 * has probably changed from "CanLoadMore" to "LoadingMore".
	 * Data might have changed too: maybe a subscription to this page
	 * query already exists (unlikely but possible) or this page query
	 * has an optimistic update providing some initial data.
	 *
	 * @internal
	 */
	loadMoreOfPaginatedQuery(token, numItems) {
		this.mustGetPaginatedQuery(token);
		const lastPageToken = this.queryTokenForLastPageOfPaginatedQuery(token);
		const lastPageResult = this.client.localQueryResultByToken(lastPageToken);
		if (!lastPageResult) {
			return false;
		}
		const paginationResult = asPaginationResult(lastPageResult);
		if (paginationResult.isDone) {
			return false;
		}
		this.addPageToPaginatedQuery(
			token,
			paginationResult.continueCursor,
			numItems,
		);
		const loadMoreTransition = {
			timestamp: this.lastTransitionTs,
			reflectedMutations: [],
			queries: [],
			paginatedQueries: [
				{
					token,
					modification: {
						kind: "Updated",
						result: this.localQueryResultByToken(token),
					},
				},
			],
		};
		this.onTransition(loadMoreTransition);
		return true;
	}
	/**
	 * @internal
	 */
	queriesContainingTokens(queryTokens) {
		if (queryTokens.length === 0) {
			return [];
		}
		const changed = [];
		const queryTokenSet = new Set(queryTokens);
		for (const [paginatedToken, paginatedQuery] of this.paginatedQuerySet) {
			for (const pageToken of this.allQueryTokens(paginatedQuery)) {
				if (queryTokenSet.has(pageToken)) {
					changed.push(paginatedToken);
					break;
				}
			}
		}
		return changed;
	}
	/**
	 * @internal
	 */
	processPaginatedQuerySplits(changed, getResult) {
		for (const paginatedQueryToken of changed) {
			const paginatedQuery = this.mustGetPaginatedQuery(paginatedQueryToken);
			const { ongoingSplits, pageKeyToQuery, pageKeys } = paginatedQuery;
			for (const [pageKey, [splitKey1, splitKey2]] of ongoingSplits) {
				const bothNewPagesLoaded =
					getResult(pageKeyToQuery.get(splitKey1).queryToken) !== void 0 &&
					getResult(pageKeyToQuery.get(splitKey2).queryToken) !== void 0;
				if (bothNewPagesLoaded) {
					this.completePaginatedQuerySplit(
						paginatedQuery,
						pageKey,
						splitKey1,
						splitKey2,
					);
				}
			}
			for (const pageKey of pageKeys) {
				if (ongoingSplits.has(pageKey)) {
					continue;
				}
				const pageEntry = pageKeyToQuery.get(pageKey);
				if (!pageEntry) {
					throw new Error(`No page query for active pageKey ${pageKey}`);
				}
				const pageResult = getResult(pageEntry.queryToken);
				if (!pageResult) {
					continue;
				}
				const result2 = asPaginationResult(pageResult);
				const shouldSplit =
					result2.splitCursor &&
					(result2.pageStatus === "SplitRecommended" ||
						result2.pageStatus === "SplitRequired" || // This client-driven page splitting condition will change in the future.
						result2.page.length > paginatedQuery.options.initialNumItems * 2);
				if (shouldSplit) {
					this.splitPaginatedQueryPage(
						paginatedQuery,
						pageKey,
						pageEntry.cursor,
						result2.splitCursor,
						// we just checked
						result2.continueCursor,
					);
				}
			}
		}
	}
	splitPaginatedQueryPage(
		paginatedQuery,
		pageKey,
		startCursor,
		splitCursor,
		continueCursor,
	) {
		const splitKey1 = paginatedQuery.nextPageKey++;
		const splitKey2 = paginatedQuery.nextPageKey++;
		const paginationOpts = {
			numItems: paginatedQuery.options.initialNumItems,
			id: paginatedQuery.id,
		};
		const firstSubscription = this.client.subscribe(
			paginatedQuery.canonicalizedUdfPath,
			{
				...paginatedQuery.args,
				paginationOpts: {
					...paginationOpts,
					cursor: startCursor,
					endCursor: splitCursor,
				},
			},
		);
		paginatedQuery.pageKeyToQuery.set(splitKey1, {
			...firstSubscription,
			cursor: startCursor,
		});
		const secondSubscription = this.client.subscribe(
			paginatedQuery.canonicalizedUdfPath,
			{
				...paginatedQuery.args,
				paginationOpts: {
					...paginationOpts,
					cursor: splitCursor,
					endCursor: continueCursor,
				},
			},
		);
		paginatedQuery.pageKeyToQuery.set(splitKey2, {
			...secondSubscription,
			cursor: splitCursor,
		});
		paginatedQuery.ongoingSplits.set(pageKey, [splitKey1, splitKey2]);
	}
	/**
	 * @internal
	 */
	addPageToPaginatedQuery(token, continueCursor, numItems) {
		const paginatedQuery = this.mustGetPaginatedQuery(token);
		const pageKey = paginatedQuery.nextPageKey++;
		const paginationOpts = {
			cursor: continueCursor,
			numItems,
			id: paginatedQuery.id,
		};
		const pageArgs = {
			...paginatedQuery.args,
			paginationOpts,
		};
		const subscription = this.client.subscribe(
			paginatedQuery.canonicalizedUdfPath,
			pageArgs,
		);
		paginatedQuery.pageKeys.push(pageKey);
		paginatedQuery.pageKeyToQuery.set(pageKey, {
			...subscription,
			cursor: continueCursor,
		});
		return subscription;
	}
	removePaginatedQuerySubscriber(token) {
		const paginatedQuery = this.paginatedQuerySet.get(token);
		if (!paginatedQuery) {
			return;
		}
		paginatedQuery.numSubscribers -= 1;
		if (paginatedQuery.numSubscribers > 0) {
			return;
		}
		for (const subscription of paginatedQuery.pageKeyToQuery.values()) {
			subscription.unsubscribe();
		}
		this.paginatedQuerySet.delete(token);
	}
	completePaginatedQuerySplit(paginatedQuery, pageKey, splitKey1, splitKey2) {
		const originalQuery = paginatedQuery.pageKeyToQuery.get(pageKey);
		paginatedQuery.pageKeyToQuery.delete(pageKey);
		const pageIndex = paginatedQuery.pageKeys.indexOf(pageKey);
		paginatedQuery.pageKeys.splice(pageIndex, 1, splitKey1, splitKey2);
		paginatedQuery.ongoingSplits.delete(pageKey);
		originalQuery.unsubscribe();
	}
	/** The query tokens for all active pages, in result order */
	activePageQueryTokens(paginatedQuery) {
		return paginatedQuery.pageKeys.map(
			(pageKey) => paginatedQuery.pageKeyToQuery.get(pageKey).queryToken,
		);
	}
	allQueryTokens(paginatedQuery) {
		return Array.from(paginatedQuery.pageKeyToQuery.values()).map(
			(sub) => sub.queryToken,
		);
	}
	queryTokenForLastPageOfPaginatedQuery(token) {
		const paginatedQuery = this.mustGetPaginatedQuery(token);
		const lastPageKey =
			paginatedQuery.pageKeys[paginatedQuery.pageKeys.length - 1];
		if (lastPageKey === void 0) {
			throw new Error(`No pages for paginated query ${token}`);
		}
		return paginatedQuery.pageKeyToQuery.get(lastPageKey).queryToken;
	}
	mustGetPaginatedQuery(token) {
		const paginatedQuery = this.paginatedQuerySet.get(token);
		if (!paginatedQuery) {
			throw new Error("paginated query no longer exists for token " + token);
		}
		return paginatedQuery;
	}
};

// node_modules/convex/dist/esm/react/client.js
var __defProp14 = Object.defineProperty;
var __defNormalProp13 = (obj, key, value) =>
	key in obj
		? __defProp14(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField13 = (obj, key, value) =>
	__defNormalProp13(obj, typeof key !== "symbol" ? key + "" : key, value);
var DEFAULT_EXTEND_SUBSCRIPTION_FOR = 5e3;
if (typeof src_default === "undefined") {
	throw new Error("Required dependency 'react' not found");
}
var ConvexReactClient = class {
	/**
	 * @param address - The url of your Convex deployment, often provided
	 * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
	 * @param options - See {@link ConvexReactClientOptions} for a full description.
	 */
	constructor(address, options3) {
		__publicField13(this, "address");
		__publicField13(this, "cachedSync");
		__publicField13(this, "cachedPaginatedQueryClient");
		__publicField13(this, "listeners");
		__publicField13(this, "options");
		__publicField13(this, "closed", false);
		__publicField13(this, "_logger");
		__publicField13(this, "adminAuth");
		__publicField13(this, "fakeUserIdentity");
		if (address === void 0) {
			throw new Error(
				"No address provided to ConvexReactClient.\nIf trying to deploy to production, make sure to follow all the instructions found at https://docs.convex.dev/production/hosting/\nIf running locally, make sure to run `convex dev` and ensure the .env.local file is populated.",
			);
		}
		if (typeof address !== "string") {
			throw new Error(
				`ConvexReactClient requires a URL like 'https://happy-otter-123.convex.cloud', received something of type ${typeof address} instead.`,
			);
		}
		if (!address.includes("://")) {
			throw new Error("Provided address was not an absolute URL.");
		}
		this.address = address;
		this.listeners = /* @__PURE__ */ new Map();
		this._logger =
			options3?.logger === false
				? instantiateNoopLogger({ verbose: options3?.verbose ?? false })
				: options3?.logger !== true && options3?.logger
					? options3.logger
					: instantiateDefaultLogger({ verbose: options3?.verbose ?? false });
		this.options = { ...options3, logger: this._logger };
	}
	/**
	 * Return the address for this client, useful for creating a new client.
	 *
	 * Not guaranteed to match the address with which this client was constructed:
	 * it may be canonicalized.
	 */
	get url() {
		return this.address;
	}
	/**
	 * Lazily instantiate the `BaseConvexClient` so we don't create the WebSocket
	 * when server-side rendering.
	 *
	 * @internal
	 */
	get sync() {
		if (this.closed) {
			throw new Error("ConvexReactClient has already been closed.");
		}
		if (this.cachedSync) {
			return this.cachedSync;
		}
		this.cachedSync =
			this.options.baseClient ??
			new BaseConvexClient(
				this.address,
				() => {},
				// Use the PaginatedQueryClient's transition instead.
				this.options,
			);
		if (this.adminAuth) {
			this.cachedSync.setAdminAuth(this.adminAuth, this.fakeUserIdentity);
		}
		this.cachedPaginatedQueryClient = new PaginatedQueryClient(
			this.cachedSync,
			(transition) => this.handleTransition(transition),
		);
		return this.cachedSync;
	}
	/**
	 * Lazily instantiate the `PaginatedQueryClient` so we don't create it
	 * when server-side rendering.
	 *
	 * @internal
	 */
	get paginatedQueryClient() {
		this.sync;
		if (this.cachedPaginatedQueryClient) {
			return this.cachedPaginatedQueryClient;
		}
		throw new Error("Should already be instantiated");
	}
	/**
	 * Set the authentication token to be used for subsequent queries and mutations.
	 * `fetchToken` will be called automatically again if a token expires.
	 * `fetchToken` should return `null` if the token cannot be retrieved, for example
	 * when the user's rights were permanently revoked.
	 * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
	 * @param onChange - a callback that will be called when the authentication status changes
	 * @param onRefreshChange - a callback called with `true` when the socket is paused to fetch a replacement token after a server rejection, and `false` when refresh completes
	 */
	setAuth(fetchToken, onChange, onRefreshChange) {
		if (typeof fetchToken === "string") {
			throw new Error(
				"Passing a string to ConvexReactClient.setAuth is no longer supported, please upgrade to passing in an async function to handle reauthentication.",
			);
		}
		this.sync.setAuth(fetchToken, onChange ?? (() => {}), onRefreshChange);
	}
	/**
	 * Clear the current authentication token if set.
	 */
	clearAuth() {
		this.sync.clearAuth();
	}
	/**
	 * @internal
	 */
	setAdminAuth(token, identity) {
		this.adminAuth = token;
		this.fakeUserIdentity = identity;
		if (this.closed) {
			throw new Error("ConvexReactClient has already been closed.");
		}
		if (this.cachedSync) {
			this.sync.setAdminAuth(token, identity);
		}
	}
	/**
	 * Construct a new {@link Watch} on a Convex query function.
	 *
	 * **Most application code should not call this method directly. Instead use
	 * the {@link useQuery} hook.**
	 *
	 * The act of creating a watch does nothing, a Watch is stateless.
	 *
	 * @param query - A {@link server.FunctionReference} for the public query to run.
	 * @param args - An arguments object for the query. If this is omitted,
	 * the arguments will be `{}`.
	 * @param options - A {@link WatchQueryOptions} options object for this query.
	 *
	 * @returns The {@link Watch} object.
	 */
	watchQuery(query, ...argsAndOptions) {
		const [args, options3] = argsAndOptions;
		const name = getFunctionName(query);
		return {
			onUpdate: (callback) => {
				const { queryToken, unsubscribe } = this.sync.subscribe(
					name,
					args,
					options3,
				);
				const currentListeners = this.listeners.get(queryToken);
				if (currentListeners !== void 0) {
					currentListeners.add(callback);
				} else {
					this.listeners.set(queryToken, /* @__PURE__ */ new Set([callback]));
				}
				return () => {
					if (this.closed) {
						return;
					}
					const currentListeners2 = this.listeners.get(queryToken);
					currentListeners2.delete(callback);
					if (currentListeners2.size === 0) {
						this.listeners.delete(queryToken);
					}
					unsubscribe();
				};
			},
			localQueryResult: () => {
				if (this.cachedSync) {
					return this.cachedSync.localQueryResult(name, args);
				}
				return void 0;
			},
			localQueryLogs: () => {
				if (this.cachedSync) {
					return this.cachedSync.localQueryLogs(name, args);
				}
				return void 0;
			},
			journal: () => {
				if (this.cachedSync) {
					return this.cachedSync.queryJournal(name, args);
				}
				return void 0;
			},
		};
	}
	// Let's try out a queryOptions-style API.
	// This method is similar to the React Query API `queryClient.prefetchQuery()`.
	// In the future an ensureQueryData(): Promise<Data> method could exist.
	/**
	 * Indicates likely future interest in a query subscription.
	 *
	 * The implementation currently immediately subscribes to a query. In the future this method
	 * may prioritize some queries over others, fetch the query result without subscribing, or
	 * do nothing in slow network connections or high load scenarios.
	 *
	 * To use this in a React component, call useQuery() and ignore the return value.
	 *
	 * @param queryOptions - A query (function reference from an api object) and its args, plus
	 * an optional extendSubscriptionFor for how long to subscribe to the query.
	 */
	prewarmQuery(queryOptions) {
		const extendSubscriptionFor =
			queryOptions.extendSubscriptionFor ?? DEFAULT_EXTEND_SUBSCRIPTION_FOR;
		const watch = this.watchQuery(queryOptions.query, queryOptions.args || {});
		const unsubscribe = watch.onUpdate(() => {});
		setTimeout(unsubscribe, extendSubscriptionFor);
	}
	/**
	 * Construct a new {@link PaginatedWatch} on a Convex paginated query function.
	 *
	 * **Most application code should not call this method directly. Instead use
	 * the {@link usePaginatedQuery} hook.**
	 *
	 * The act of creating a watch does nothing, a Watch is stateless.
	 *
	 * @param query - A {@link server.FunctionReference} for the public query to run.
	 * @param args - An arguments object for the query. If this is omitted,
	 * the arguments will be `{}`.
	 * @param options - A {@link WatchPaginatedQueryOptions} options object for this query.
	 *
	 * @returns The {@link PaginatedWatch} object.
	 *
	 * @internal
	 */
	watchPaginatedQuery(query, args, options3) {
		const name = getFunctionName(query);
		return {
			onUpdate: (callback) => {
				const { paginatedQueryToken, unsubscribe } =
					this.paginatedQueryClient.subscribe(name, args || {}, options3);
				const currentListeners = this.listeners.get(paginatedQueryToken);
				if (currentListeners !== void 0) {
					currentListeners.add(callback);
				} else {
					this.listeners.set(
						paginatedQueryToken,
						/* @__PURE__ */ new Set([callback]),
					);
				}
				return () => {
					if (this.closed) {
						return;
					}
					const currentListeners2 = this.listeners.get(paginatedQueryToken);
					currentListeners2.delete(callback);
					if (currentListeners2.size === 0) {
						this.listeners.delete(paginatedQueryToken);
					}
					unsubscribe();
				};
			},
			localQueryResult: () => {
				return this.paginatedQueryClient.localQueryResult(name, args, options3);
			},
		};
	}
	/**
	 * Execute a mutation function.
	 *
	 * @param mutation - A {@link server.FunctionReference} for the public mutation
	 * to run.
	 * @param args - An arguments object for the mutation. If this is omitted,
	 * the arguments will be `{}`.
	 * @param options - A {@link MutationOptions} options object for the mutation.
	 * @returns A promise of the mutation's result.
	 */
	mutation(mutation, ...argsAndOptions) {
		const [args, options3] = argsAndOptions;
		const name = getFunctionName(mutation);
		return this.sync.mutation(name, args, options3);
	}
	/**
	 * Execute an action function.
	 *
	 * @param action - A {@link server.FunctionReference} for the public action
	 * to run.
	 * @param args - An arguments object for the action. If this is omitted,
	 * the arguments will be `{}`.
	 * @returns A promise of the action's result.
	 */
	action(action, ...args) {
		const name = getFunctionName(action);
		return this.sync.action(name, ...args);
	}
	/**
	 * Fetch a query result once.
	 *
	 * **Most application code should subscribe to queries instead, using
	 * the {@link useQuery} hook.**
	 *
	 * @param query - A {@link server.FunctionReference} for the public query
	 * to run.
	 * @param args - An arguments object for the query. If this is omitted,
	 * the arguments will be `{}`.
	 * @returns A promise of the query's result.
	 */
	query(query, ...args) {
		const watch = this.watchQuery(query, ...args);
		const existingResult = watch.localQueryResult();
		if (existingResult !== void 0) {
			return Promise.resolve(existingResult);
		}
		return new Promise((resolve, reject) => {
			const unsubscribe = watch.onUpdate(() => {
				unsubscribe();
				try {
					resolve(watch.localQueryResult());
				} catch (e) {
					reject(e);
				}
			});
		});
	}
	/**
	 * Get the current {@link ConnectionState} between the client and the Convex
	 * backend.
	 *
	 * @returns The {@link ConnectionState} with the Convex backend.
	 */
	connectionState() {
		return this.sync.connectionState();
	}
	/**
	 * Subscribe to the {@link ConnectionState} between the client and the Convex
	 * backend, calling a callback each time it changes.
	 *
	 * Subscribed callbacks will be called when any part of ConnectionState changes.
	 * ConnectionState may grow in future versions (e.g. to provide a array of
	 * inflight requests) in which case callbacks would be called more frequently.
	 * ConnectionState may also *lose* properties in future versions as we figure
	 * out what information is most useful. As such this API is considered unstable.
	 *
	 * @returns An unsubscribe function to stop listening.
	 */
	subscribeToConnectionState(cb) {
		return this.sync.subscribeToConnectionState(cb);
	}
	/**
	 * Get the logger for this client.
	 *
	 * @returns The {@link Logger} for this client.
	 */
	get logger() {
		return this._logger;
	}
	/**
	 * Close any network handles associated with this client and stop all subscriptions.
	 *
	 * Call this method when you're done with a {@link ConvexReactClient} to
	 * dispose of its sockets and resources.
	 *
	 * @returns A `Promise` fulfilled when the connection has been completely closed.
	 */
	async close() {
		this.closed = true;
		this.listeners = /* @__PURE__ */ new Map();
		if (this.cachedPaginatedQueryClient) {
			this.cachedPaginatedQueryClient = void 0;
		}
		if (this.cachedSync) {
			const sync = this.cachedSync;
			this.cachedSync = void 0;
			await sync.close();
		}
	}
	/**
	 * Handle transitions from both base client and paginated client.
	 * This ensures all transitions are processed synchronously and in order.
	 */
	handleTransition(transition) {
		const simple = transition.queries.map((q) => q.token);
		const paginated = transition.paginatedQueries.map((q) => q.token);
		this.transition([...simple, ...paginated]);
	}
	transition(updatedQueries) {
		for (const queryToken of updatedQueries) {
			const callbacks = this.listeners.get(queryToken);
			if (callbacks) {
				for (const callback of callbacks) {
					callback();
				}
			}
		}
	}
};
var ConvexContext = src_default.createContext(
	void 0,
	// in the future this will be a mocked client for testing
);

// node_modules/convex/dist/esm/react/ConvexAuthState.js
var ConvexAuthContext = createContext(void 0);

// node_modules/convex/dist/esm/server/pagination.js
var paginationOptsValidator = v.object({
	numItems: v.number(),
	cursor: v.union(v.string(), v.null()),
	endCursor: v.optional(v.union(v.string(), v.null())),
	id: v.optional(v.number()),
	maximumRowsRead: v.optional(v.number()),
	maximumBytesRead: v.optional(v.number()),
});

// node_modules/convex/dist/esm/server/logVars.js
var REQUEST_ID = /* @__PURE__ */ Symbol("var.requestId");
var IP = /* @__PURE__ */ Symbol("var.ip");
var USER_AGENT = /* @__PURE__ */ Symbol("var.userAgent");
var NOW = /* @__PURE__ */ Symbol("var.now");
var CONVEX_ACTOR = /* @__PURE__ */ Symbol("var.convexActor");
var varNames = {
	[REQUEST_ID]: "requestId",
	[IP]: "ip",
	[USER_AGENT]: "userAgent",
	[NOW]: "now",
	[CONVEX_ACTOR]: "convexActor",
};

// node_modules/convex/dist/esm/server/schema.js
var __defProp15 = Object.defineProperty;
var __defNormalProp14 = (obj, key, value) =>
	key in obj
		? __defProp15(obj, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value,
			})
		: (obj[key] = value);
var __publicField14 = (obj, key, value) =>
	__defNormalProp14(obj, typeof key !== "symbol" ? key + "" : key, value);
var TableDefinition = class {
	/**
	 * @internal
	 */
	constructor(documentType) {
		__publicField14(this, "indexes");
		__publicField14(this, "stagedDbIndexes");
		__publicField14(this, "searchIndexes");
		__publicField14(this, "stagedSearchIndexes");
		__publicField14(this, "vectorIndexes");
		__publicField14(this, "stagedVectorIndexes");
		__publicField14(this, "validator");
		__publicField14(this, "stagedValidator");
		this.indexes = [];
		this.stagedDbIndexes = [];
		this.searchIndexes = [];
		this.stagedSearchIndexes = [];
		this.vectorIndexes = [];
		this.stagedVectorIndexes = [];
		this.validator = documentType;
	}
	/**
	 * This API is experimental: it may change or disappear.
	 *
	 * Returns indexes defined on this table.
	 * Intended for the advanced use cases of dynamically deciding which index to use for a query.
	 * If you think you need this, please chime in on ths issue in the Convex JS GitHub repo.
	 * https://github.com/get-convex/convex-js/issues/49
	 */
	" indexes"() {
		return this.indexes;
	}
	index(name, indexConfig) {
		if (Array.isArray(indexConfig)) {
			this.indexes.push({
				indexDescriptor: name,
				fields: indexConfig,
			});
		} else if (indexConfig.staged) {
			this.stagedDbIndexes.push({
				indexDescriptor: name,
				fields: indexConfig.fields,
			});
		} else {
			this.indexes.push({
				indexDescriptor: name,
				fields: indexConfig.fields,
			});
		}
		return this;
	}
	searchIndex(name, indexConfig) {
		if (indexConfig.staged) {
			this.stagedSearchIndexes.push({
				indexDescriptor: name,
				searchField: indexConfig.searchField,
				filterFields: indexConfig.filterFields || [],
			});
		} else {
			this.searchIndexes.push({
				indexDescriptor: name,
				searchField: indexConfig.searchField,
				filterFields: indexConfig.filterFields || [],
			});
		}
		return this;
	}
	vectorIndex(name, indexConfig) {
		if (indexConfig.staged) {
			this.stagedVectorIndexes.push({
				indexDescriptor: name,
				vectorField: indexConfig.vectorField,
				dimensions: indexConfig.dimensions,
				filterFields: indexConfig.filterFields || [],
			});
		} else {
			this.vectorIndexes.push({
				indexDescriptor: name,
				vectorField: indexConfig.vectorField,
				dimensions: indexConfig.dimensions,
				filterFields: indexConfig.filterFields || [],
			});
		}
		return this;
	}
	/**
	 * Stage changes to this table's document validator.
	 *
	 * Convex validates the staged validator against the table's existing
	 * documents in the background, while the validator passed to
	 * {@link defineTable} remains the one enforced on writes. Once
	 * the background validation succeeds, apply the staged changes
	 * and remove `.staged()`.
	 *
	 * For an object validator, pass only the fields to add or replace. Fields
	 * omitted from the changes keep their enforced validators.
	 * Set a field to `undefined` to remove it from the staged validator.
	 * For nested objects, you must specify the full object validator.
	 *
	 * ```ts
	 * defineTable({
	 *   apple: v.string(),
	 *   banana: v.number(),
	 *   legacy: v.optional(v.string()),
	 * }).staged({
	 *   banana: v.union(v.string(), v.number()),
	 *   legacy: undefined,
	 * })
	 * ```
	 *
	 * See [Staged validators](https://docs.convex.dev/database/schemas#staged-validators).
	 *
	 * @param documentSchema - Field changes for a table defined as an object or
	 * `v.any()`, or a full schema validator specifying the proposed next document
	 * type. Use a full schema validator for a table defined as a union.
	 * @returns A {@link TableDefinition} with the staged validator attached.
	 */
	staged(documentSchema) {
		if (this.stagedValidator !== void 0) {
			throw new Error("Table cannot have more than one staged validator.");
		}
		if (isValidator(documentSchema)) {
			this.stagedValidator = documentSchema;
		} else {
			if (this.validator.kind !== "object" && this.validator.kind !== "any") {
				throw new Error(
					"Specifying top-level field changes is only supported for simple table definitions. For a table defined with a union or record validator, you must stage a fully defined object or union validator.",
				);
			}
			const enforcedFields =
				this.validator.kind === "object" ? this.validator.fields : {};
			const fields = Object.fromEntries(
				Object.entries({ ...enforcedFields, ...documentSchema }).filter(
					(entry) => entry[1] !== void 0,
				),
			);
			this.stagedValidator = v.object(fields);
		}
		return this.self();
	}
	/**
	 * Work around for https://github.com/microsoft/TypeScript/issues/57035
	 */
	self() {
		return this;
	}
	/**
	 * Export the contents of this definition.
	 *
	 * This is called internally by the Convex framework.
	 * @internal
	 */
	export() {
		const documentType = this.validator.json;
		if (typeof documentType !== "object") {
			throw new Error(
				"Invalid validator: please make sure that the parameter of `defineTable` is valid (see https://docs.convex.dev/database/schemas)",
			);
		}
		let stagedDocumentType = void 0;
		if (this.stagedValidator !== void 0) {
			stagedDocumentType = this.stagedValidator.json;
			if (typeof stagedDocumentType !== "object") {
				throw new Error(
					"Invalid staged validator: please make sure that the parameter of `.staged()` is valid (see https://docs.convex.dev/database/schemas)",
				);
			}
		}
		return {
			indexes: this.indexes,
			stagedDbIndexes: this.stagedDbIndexes,
			searchIndexes: this.searchIndexes,
			stagedSearchIndexes: this.stagedSearchIndexes,
			vectorIndexes: this.vectorIndexes,
			stagedVectorIndexes: this.stagedVectorIndexes,
			documentType,
			stagedDocumentType,
		};
	}
};
function defineTable(documentSchema) {
	if (isValidator(documentSchema)) {
		return new TableDefinition(documentSchema);
	} else {
		return new TableDefinition(v.object(documentSchema));
	}
}
function addSystemFields(tableName, validator) {
	switch (validator.kind) {
		case "object":
			return validator.extend({
				_id: v.id(tableName),
				_creationTime: v.number(),
			});
		case "union":
			return v.union(
				...validator.members.map((member) =>
					addSystemFields(tableName, member),
				),
			);
		// `v.any()` already permits the system fields.
		case "any":
			return validator;
		default:
			throw new Error(
				`Invalid validator for table "${tableName}": a table's documents must be objects, or a union of objects (see https://docs.convex.dev/database/schemas)`,
			);
	}
}
function docValidator(tableName, table) {
	return addSystemFields(tableName, table.validator);
}
function tableInSchema(schema, tableName) {
	const table = schema.tables[tableName];
	if (table === void 0) {
		throw new Error(
			`Table "${tableName}" is not in this schema. Tables in this schema: ${Object.keys(
				schema.tables,
			).join(", ")}`,
		);
	}
	return table;
}
var SchemaDefinition = class {
	/**
	 * @internal
	 */
	constructor(tables, options3) {
		__publicField14(this, "tables");
		__publicField14(this, "strictTableNameTypes");
		__publicField14(this, "schemaValidation");
		this.tables = tables;
		this.schemaValidation =
			options3?.schemaValidation === void 0 ? true : options3.schemaValidation;
	}
	/**
	 * The validator for whole documents of a table in this schema: the table's
	 * own validator with the `_id` and `_creationTime` system fields added.
	 *
	 * @example
	 * ```ts
	 * export const get = query({
	 *   args: { id: schema.id("messages") },
	 *   returns: v.union(schema.doc("messages"), v.null()),
	 *   handler: (ctx, args) => ctx.db.get(args.id),
	 * });
	 * ```
	 *
	 * @param tableName - The name of a table in this schema.
	 * @returns A validator matching documents of that table.
	 */
	doc(tableName) {
		return docValidator(tableName, tableInSchema(this, tableName));
	}
	/**
	 * The validator for IDs of a table in this schema.
	 *
	 * Same as `v.id(tableName)`, but only accepts tables in this schema.
	 *
	 * @param tableName - The name of a table in this schema.
	 * @returns A validator matching IDs of that table.
	 */
	id(tableName) {
		tableInSchema(this, tableName);
		return v.id(tableName);
	}
	/**
	 * Export the contents of this definition.
	 *
	 * This is called internally by the Convex framework.
	 * @internal
	 */
	export() {
		return JSON.stringify({
			tables: Object.entries(this.tables).map(([tableName, definition]) => {
				const {
					indexes,
					stagedDbIndexes,
					searchIndexes,
					stagedSearchIndexes,
					vectorIndexes,
					stagedVectorIndexes,
					documentType,
					stagedDocumentType,
				} = definition.export();
				return {
					tableName,
					indexes,
					stagedDbIndexes,
					searchIndexes,
					stagedSearchIndexes,
					vectorIndexes,
					stagedVectorIndexes,
					documentType,
					stagedDocumentType,
				};
			}),
			schemaValidation: this.schemaValidation,
		});
	}
};
function defineSchema(schema, options3) {
	return new SchemaDefinition(schema, options3);
}
var _systemSchema = defineSchema({
	_scheduled_functions: defineTable({
		name: v.string(),
		args: v.array(v.any()),
		scheduledTime: v.float64(),
		completedTime: v.optional(v.float64()),
		state: v.union(
			v.object({ kind: v.literal("pending") }),
			v.object({ kind: v.literal("inProgress") }),
			v.object({ kind: v.literal("success") }),
			v.object({ kind: v.literal("failed"), error: v.string() }),
			v.object({ kind: v.literal("canceled") }),
		),
	}),
	_storage: defineTable({
		sha256: v.string(),
		size: v.float64(),
		contentType: v.optional(v.string()),
	}),
});

// node_modules/bonobo-plugin-sdk/frontend.js
var bonobo_convex_api =
	/**
	 * @type {any}
	 */
	anyApi;
var TOKEN_EXPIRY_MARGIN_MS = 6e4;
var READY_RETRY_MS = 500;
var REFRESH_DEADLINE_MS = 1e4;
var AUTH_WAKE_POLL_MS = 1e3;
var AUTH_WAKE_GAP_MS = 3e4;
var NONCE_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function read_theme(value) {
	if (typeof value !== "object" || value === null) {
		return null;
	}
	const candidate =
		/**
		 * @type {{ mode?: unknown, tokens?: unknown }}
		 */
		value;
	if (candidate.mode !== "light" && candidate.mode !== "dark") {
		return null;
	}
	if (typeof candidate.tokens !== "object" || candidate.tokens === null) {
		return null;
	}
	const tokens = {};
	for (const [name, tokenValue] of Object.entries(candidate.tokens)) {
		if (typeof tokenValue !== "string") {
			return null;
		}
		tokens[name] = tokenValue;
	}
	return (
		/**
		 * @type {import("bonobo-plugin-sdk/frontend").BonoboTheme}
		 */
		{ mode: candidate.mode, tokens }
	);
}
function apply_theme(theme) {
	const root = document.documentElement;
	for (const [name, value] of Object.entries(theme.tokens)) {
		root.style.setProperty(name, value);
	}
	root.classList.toggle("light", theme.mode === "light");
	root.classList.toggle("dark", theme.mode === "dark");
}
function is_ui_context(value) {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const context =
		/** @type {Record<string, unknown>} */
		value;
	if (
		typeof context.pluginName !== "string" ||
		typeof context.userId !== "string" ||
		typeof context.organizationId !== "string" ||
		typeof context.workspaceId !== "string"
	) {
		return false;
	}
	if (context.kind === "page") {
		return (
			typeof context.pageId === "string" &&
			typeof context.pageTitle === "string"
		);
	}
	if (context.kind === "file_view") {
		if (
			typeof context.fileViewId !== "string" ||
			typeof context.fileViewTitle !== "string"
		) {
			return false;
		}
		if (typeof context.file !== "object" || context.file === null) {
			return false;
		}
		const file =
			/** @type {Record<string, unknown>} */
			context.file;
		return (
			typeof file.fileNodeId === "string" &&
			typeof file.name === "string" &&
			typeof file.path === "string" &&
			typeof file.contentType === "string"
		);
	}
	return false;
}
function read_bridge_bootstrap() {
	const fragment = window.location.hash.slice(1);
	if (!fragment) {
		throw new Error(
			"Missing host bridge fragment \u2014 this plugin frame must be embedded by the Bonobo host app",
		);
	}
	const params = new URLSearchParams(fragment);
	const parentOrigins = params.getAll("parentOrigin");
	const nonces = params.getAll("nonce");
	if (params.size !== 2 || parentOrigins.length !== 1 || nonces.length !== 1) {
		throw new Error("Invalid host bridge fragment");
	}
	const parentOrigin = parentOrigins[0];
	const nonce = nonces[0];
	let parsedParentOrigin;
	try {
		parsedParentOrigin = new URL(parentOrigin);
	} catch {
		throw new Error("Invalid host bridge parent origin");
	}
	if (
		(parsedParentOrigin.protocol !== "http:" &&
			parsedParentOrigin.protocol !== "https:") ||
		parsedParentOrigin.origin !== parentOrigin
	) {
		throw new Error("Invalid host bridge parent origin");
	}
	if (!NONCE_PATTERN.test(nonce)) {
		throw new Error("Invalid host bridge nonce");
	}
	return { parentOrigin, nonce };
}
async function bonobo_connect() {
	const { parentOrigin, nonce } = read_bridge_bootstrap();
	let apiOrigin = "";
	let token = "";
	let tokenExpiresAt = 0;
	let jwt = "";
	let jwtExpiresAt = 0;
	let theme = null;
	const themeSubscribers = /* @__PURE__ */ new Set();
	const agentTools = /* @__PURE__ */ new Map();
	const pending_refreshes = /* @__PURE__ */ new Map();
	let refresh_in_flight = null;
	async function getToken() {
		if (Date.now() >= tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) {
			return refreshToken();
		}
		return token;
	}
	function refreshToken() {
		if (refresh_in_flight) {
			return refresh_in_flight;
		}
		const requestId = crypto.randomUUID();
		refresh_in_flight = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending_refreshes.delete(requestId);
				reject(new Error("Plugin frame token refresh timed out"));
			}, REFRESH_DEADLINE_MS);
			pending_refreshes.set(requestId, { resolve, reject, timeout });
			try {
				window.parent.postMessage(
					{ type: "bonobo:token-refresh-request", nonce, requestId },
					parentOrigin,
				);
			} catch (error) {
				clearTimeout(timeout);
				pending_refreshes.delete(requestId);
				reject(error);
			}
		}).finally(() => {
			refresh_in_flight = null;
		});
		return refresh_in_flight;
	}
	const jwt_is_fresh = () =>
		jwt !== "" && Date.now() < jwtExpiresAt - TOKEN_EXPIRY_MARGIN_MS;
	const store_delivered_jwt = (message) => {
		if (
			typeof message.jwt === "string" &&
			typeof message.jwtExpiresAt === "number" &&
			Number.isFinite(message.jwtExpiresAt)
		) {
			jwt = message.jwt;
			jwtExpiresAt = message.jwtExpiresAt;
		} else {
			jwt = "";
			jwtExpiresAt = 0;
		}
	};
	async function fetchJson(path, body, init) {
		const payload = JSON.stringify(body);
		const send = (bearer) => {
			const headers = new Headers(init?.headers);
			headers.set("Authorization", `Bearer ${bearer}`);
			headers.set("Content-Type", "application/json");
			headers.set("Accept", "application/json");
			return fetch(apiOrigin + path, {
				...init,
				method: "POST",
				body: payload,
				headers,
				redirect: "error",
			});
		};
		const firstBearer = await getToken();
		let response = await send(firstBearer);
		if (response.status === 401) {
			response = await send(
				token !== firstBearer ? token : await refreshToken(),
			);
		}
		const responseText = await response.text();
		let parsedBody = null;
		try {
			parsedBody = JSON.parse(responseText);
		} catch {}
		return (
			/**
			 * @type {import("bonobo-plugin-sdk/http-api").BonoboHttpResponse<P>}
			 */
			{
				status: response.status,
				body: parsedBody,
			}
		);
	}
	async function authorize(headers) {
		const authorized = new Headers(headers);
		authorized.set("Authorization", `Bearer ${await getToken()}`);
		return authorized;
	}
	const exchange_session_jwt = (sessionToken) =>
		fetch(apiOrigin + "/plugins-ui/session-jwt", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: sessionToken }),
		});
	async function fetch_convex_jwt(args) {
		const forceRefreshToken = args?.forceRefreshToken === true;
		for (let attempt = 0; ; attempt += 1) {
			if (jwt_is_fresh() && !forceRefreshToken) {
				return jwt;
			}
			let response = null;
			try {
				if (jwt !== "") {
					await refreshToken();
					if (jwt_is_fresh()) {
						return jwt;
					}
				}
				response = await exchange_session_jwt(await getToken());
				if (response.status === 401) {
					response = await exchange_session_jwt(await refreshToken());
				}
			} catch {
				response = null;
			}
			if (response?.ok) {
				const body = await response.json().catch(() => null);
				const exchangedJwt = body?._yay?.jwt;
				const sessionExpiresAt = body?._yay?.sessionExpiresAt;
				if (
					typeof exchangedJwt !== "string" ||
					typeof sessionExpiresAt !== "number"
				) {
					return null;
				}
				tokenExpiresAt = sessionExpiresAt;
				jwt = exchangedJwt;
				jwtExpiresAt = sessionExpiresAt;
				return exchangedJwt;
			}
			const transient =
				response === null || response.status === 429 || response.status >= 500;
			if (!transient || attempt >= 2) {
				return null;
			}
			await new Promise((resolveWait) =>
				setTimeout(resolveWait, 1e3 * (attempt + 1)),
			);
		}
	}
	const client_promise = new Promise((resolve) => {
		let initialized = false;
		let readyInterval;
		const post_ready = () => {
			window.parent.postMessage({ type: "bonobo:ready", nonce }, parentOrigin);
		};
		const stop_ready = () => {
			clearInterval(readyInterval);
		};
		const handle_message = (event) => {
			if (event.source !== window.parent || event.origin !== parentOrigin) {
				return;
			}
			const message = event.data;
			if (typeof message !== "object" || message === null) {
				return;
			}
			if (
				message.type === "bonobo:init" &&
				!initialized &&
				message.nonce === nonce &&
				typeof message.apiOrigin === "string" &&
				typeof message.convexUrl === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt) &&
				is_ui_context(message.context)
			) {
				initialized = true;
				stop_ready();
				window.removeEventListener("pagehide", stop_ready);
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				store_delivered_jwt(message);
				const convexClient = new ConvexReactClient(message.convexUrl, {
					expectAuth: true,
					unsavedChangesWarning: false,
					initialAuthTokenReuse: true,
				});
				let lastAuthWakePollAt = Date.now();
				const authWakeInterval = setInterval(() => {
					const now = Date.now();
					if (now - lastAuthWakePollAt >= AUTH_WAKE_GAP_MS) {
						convexClient.setAuth(fetch_convex_jwt);
					}
					lastAuthWakePollAt = now;
				}, AUTH_WAKE_POLL_MS);
				convexClient.setAuth(fetch_convex_jwt);
				window.addEventListener(
					"pagehide",
					() => {
						clearInterval(authWakeInterval);
						void convexClient.close();
					},
					{ once: true },
				);
				theme = read_theme(message.theme);
				if (theme) {
					apply_theme(theme);
				}
				resolve({
					context: message.context,
					apiOrigin,
					getToken,
					refreshToken,
					fetchJson,
					authorize,
					convex: convexClient,
					api: bonobo_convex_api,
					session: {
						// The one thing that tells a lapsed session apart from a refused read. The
						// doors answer the same opaque null (or empty page) for both, so this clock is
						// the whole difference, and it lives in this closure.
						expiresAt: () => tokenExpiresAt,
						fetchJwt: fetch_convex_jwt,
					},
					theme: {
						current: () => theme,
						subscribe(onChange) {
							themeSubscribers.add(onChange);
							return () => {
								themeSubscribers.delete(onChange);
							};
						},
					},
					agent: {
						registerTool(name, handler) {
							agentTools.set(name, handler);
							return () => {
								if (agentTools.get(name) === handler) {
									agentTools.delete(name);
								}
							};
						},
					},
				});
			} else if (
				initialized &&
				message.nonce === nonce &&
				message.type === "bonobo:token" &&
				typeof message.requestId === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt)
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					token = message.token;
					tokenExpiresAt = message.tokenExpiresAt;
					store_delivered_jwt(message);
					pending.resolve(message.token);
				}
			} else if (
				initialized &&
				message.nonce === nonce &&
				message.type === "bonobo:theme"
			) {
				const next = read_theme(message.theme);
				if (next) {
					theme = next;
					apply_theme(next);
					for (const onChange of themeSubscribers) {
						onChange(next);
					}
				}
			} else if (
				initialized &&
				message.nonce === nonce &&
				message.type === "bonobo:token-error" &&
				typeof message.requestId === "string" &&
				typeof message.message === "string"
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					pending.reject(new Error(message.message));
				}
			} else if (
				initialized &&
				message.nonce === nonce &&
				message.type === "bonobo:agent-tool-call" &&
				typeof message.callId === "string" &&
				typeof message.toolName === "string"
			) {
				const callId = message.callId;
				const reply = (answer) => {
					try {
						window.parent.postMessage(
							{ type: "bonobo:agent-tool-result", nonce, callId, ...answer },
							parentOrigin,
						);
					} catch {
						window.parent.postMessage(
							{
								type: "bonobo:agent-tool-result",
								nonce,
								callId,
								ok: false,
								error: "The tool output could not be sent",
							},
							parentOrigin,
						);
					}
				};
				const handler = agentTools.get(message.toolName);
				if (!handler) {
					reply({
						ok: false,
						error: `This page has no tool named ${message.toolName}`,
					});
				} else {
					Promise.resolve()
						.then(() => handler(message.input))
						.then(
							(output) => reply({ ok: true, output }),
							(error) =>
								reply({
									ok: false,
									error: error instanceof Error ? error.message : String(error),
								}),
						);
				}
			}
		};
		window.addEventListener("message", handle_message);
		window.addEventListener("pagehide", stop_ready, { once: true });
		post_ready();
		readyInterval = setInterval(post_ready, READY_RETRY_MS);
	});
	return client_promise;
}

// src/frontend.ts
var form = document.querySelector("#probe-form");
var select = document.querySelector("#probe-case");
var runButton = document.querySelector("#run-probe");
var refreshButton = document.querySelector("#refresh-probes");
var status = document.querySelector("#status");
var result = document.querySelector("#result");
var saved = document.querySelector("#saved-probes");
var encoder = new TextEncoder();
function is_record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function small_message(output) {
	if (output.length > 4096 || output.length === 0) return null;
	try {
		const parsed = JSON.parse(output);
		return is_record(parsed) && typeof parsed.message === "string"
			? parsed.message.slice(0, 300)
			: null;
	} catch {
		return null;
	}
}
async function connect() {
	const client = await bonobo_connect();
	runButton.disabled = false;
	refreshButton.disabled = false;
	status.textContent = "Ready.";
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (runButton.disabled) return;
		const caseName = select.value;
		runButton.disabled = true;
		refreshButton.disabled = true;
		form.setAttribute("aria-busy", "true");
		status.textContent = `Running ${caseName}\u2026`;
		try {
			const response = await client.fetchJson("/api/v1/plugin-backend/invoke", {
				endpoint: "probe",
				input: { case: caseName },
			});
			const body = response.body;
			if (
				response.status === 200 &&
				is_record(body) &&
				typeof body.runId === "string" &&
				typeof body.pluginStatus === "number" &&
				typeof body.output === "string"
			) {
				const bytes = encoder.encode(body.output);
				const digest = await crypto.subtle.digest("SHA-256", bytes);
				const sha256 = Array.from(new Uint8Array(digest), (byte) =>
					byte.toString(16).padStart(2, "0"),
				).join("");
				result.textContent = JSON.stringify(
					{
						case: caseName,
						status: response.status,
						runId: body.runId,
						pluginStatus: body.pluginStatus,
						outputBytes: bytes.byteLength,
						sha256,
						encodedReplyBytes: encoder.encode(JSON.stringify(body)).byteLength,
						message: small_message(body.output),
					},
					null,
					2,
				);
			} else {
				result.textContent = JSON.stringify(
					{
						case: caseName,
						status: response.status,
						runId:
							is_record(body) && typeof body.runId === "string"
								? body.runId
								: null,
						code:
							is_record(body) && typeof body.code === "string"
								? body.code.slice(0, 64)
								: null,
						message:
							is_record(body) && typeof body.message === "string"
								? body.message.slice(0, 300)
								: "Invalid host reply",
					},
					null,
					2,
				);
			}
			status.textContent = "Finished. The summary is below.";
		} catch {
			status.textContent =
				"No host reply arrived. Earlier changes may be saved. This case was not retried.";
			result.textContent = JSON.stringify(
				{ case: caseName, status: "No response" },
				null,
				2,
			);
		} finally {
			runButton.disabled = false;
			refreshButton.disabled = false;
			form.removeAttribute("aria-busy");
		}
	});
	refreshButton.addEventListener("click", async () => {
		if (refreshButton.disabled) return;
		refreshButton.disabled = true;
		runButton.disabled = true;
		status.textContent = "Loading saved test documents\u2026";
		try {
			const response = await client.fetchJson("/api/v1/plugin-data/list", {
				collection: "response_probes",
				keyPrefix: "qa-",
				limit: 100,
			});
			const body = response.body;
			if (
				response.status !== 200 ||
				!is_record(body) ||
				!Array.isArray(body.documents)
			) {
				status.textContent = `Saved document read refused with HTTP ${response.status}.`;
				return;
			}
			saved.replaceChildren();
			for (const doc of body.documents) {
				if (
					!is_record(doc) ||
					typeof doc.key !== "string" ||
					!is_record(doc.value)
				)
					continue;
				const caseName =
					typeof doc.value.case === "string"
						? doc.value.case.slice(0, 64)
						: "unknown case";
				const item = document.createElement("li");
				item.textContent = `${doc.key.slice(0, 160)} \u2014 ${caseName}`;
				saved.append(item);
			}
			status.textContent = `${saved.children.length} test documents shown (up to 100). Existing upload documents stay unchanged.`;
		} catch {
			status.textContent =
				"Saved documents could not be read. Try Refresh again.";
		} finally {
			refreshButton.disabled = false;
			runButton.disabled = false;
		}
	});
}
connect().catch(() => {
	status.textContent =
		"Could not connect to the host. Reload this plugin page.";
});
