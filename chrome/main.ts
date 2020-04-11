/**
 * This is the main script that reads the document and updates any Arabic script text
 */

///<reference path="../../../.WebStorm2019.3/config/javascript/extLibs/global-types/node_modules/@types/chrome/index.d.ts"/>
///<reference path="./shared.ts"/>


/**
 * This Arabic regex allows and accepts any non Arabic symbols next to Arabic symbols,
 * this means that it accepts anything as long as it has some Arabic symbol in it
 */
const arabicRegex = new RegExp("([\u0600-\u06FF\u0750-\u077F\u08a0-\u08ff\uFB50-\uFDFF\uFE70-\uFEFF\]+([\u0600-\u06FF\u0750-\u077F\u08a0-\u08ff\uFB50-\uFDFF\uFE70-\uFEFF\\W\\d]+)*)", "g");

/** The observer used in {@linkcode startObserver} to dynamically update any newly added Nodes */
let observer: MutationObserver;

function hasBeenUpdated(node: Node): boolean {
    return node.parentElement && node.parentElement.getAttribute("wudooh") === "true";
}

/**
 * Returns whether the given node has any Arabic script or not, this is any script that matches arabicRegEx
 * @param node the node to check
 * @return true if the node contains any arabic script, false otherwise
 */
function hasArabicScript(node: Node): boolean {
    return !!node.nodeValue && !!(node.nodeValue.match(arabicRegex));
}

/**
 * Gets all nodes within the passed in node that have any Arabic text
 * @param rootNode the node to use as the root of the traversal
 * @return an array of nodes that contain all the nodes with Arabic text that are children of the passed in
 * root node
 */
function getArabicTextNodesIn(rootNode: Node): Array<Node> {
    let treeWalker: TreeWalker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT
    );
    let arabicTextNodes: Array<Node> = [];

    let node: Node = treeWalker.nextNode();
    while (!!node) {
        if (hasArabicScript(node)) arabicTextNodes.push(node);
        node = treeWalker.nextNode();
    }
    return arabicTextNodes;
}

/**
 * Sets the node's html content to the passed in html string
 * @param node the node to change the html of
 * @param html the html string that will be the passed in node's html
 */
function setNodeHtml(node: Node, html: string) {
    let parent: Node = node.parentNode;

    // return if parent or node are null
    if (!parent || !node) return;
    // don't change anything if this node or its parent are editable
    if (isEditable(parent) || isEditable(node)) return;

    let nextSibling: ChildNode = node.nextSibling;

    // the div is temporary and doesn't show up in the html
    let newElement: HTMLDivElement = document.createElement("div");
    newElement.innerHTML = html;

    while (newElement.firstChild) {
        // we only insert the passed in html, the div is not inserted
        parent.insertBefore(newElement.firstChild, nextSibling);
    }
    parent.removeChild(node);
}

/**
 * Checks whether the passed in node is editable or not.
 * An editable node is one that returns true to isContentEditable or has a tag name as
 * any one of the following:
 * "textarea", "input", "text", "email", "number", "search", "tel", "url", "password"
 *
 * @param node the node to check
 * @return true if the node is editable and false otherwise
 */
function isEditable(node: Node): boolean {
    let element: HTMLElement = node as HTMLElement;
    let nodeName: string = element.nodeName.toLowerCase();

    return (element.isContentEditable || (element.nodeType === Node.ELEMENT_NODE && htmlEditables.contains(nodeName)));
}

/**
 * Updates the passed in node's html to have the properties of a modified Arabic text node, this will
 * replace any text that matches arabicRegEx to be a span with the font size and line height specified by
 * the user's options, the span will have a class='ar', this can be used to check if the text has been
 * updated by this function or not
 * @param node the node to update
 * @param textSize the size to update the text to
 * @param lineHeight the height to update the line to
 * @param font the name of the font to update the text to
 */
function updateNode(node: Node, textSize: number, lineHeight: number, font: string = defaultFont) {
    let newSize: number = textSize / 100;
    let newHeight: number = lineHeight / 100;

    if (!!node.nodeValue) {
        if (hasBeenUpdated(node)) updateByChanging(node, newSize, newHeight, font);
        else if (!hasBeenUpdated(node)) updateByAdding(node, newSize, newHeight, font);
    }
}

function updateByAdding(node: Node, textSize: number, lineHeight: number, font: string) {
    let newHTML: string;
    if (font === "Original") {
        newHTML = "<span wudooh='true' style='" +
            "font-size:" + textSize + "em;" +
            "line-height:" + lineHeight + "em;" +
            "'>$&</span>";
    } else {
        newHTML = "<span wudooh='true' style='" +
            "font-size:" + textSize + "em;" +
            "line-height:" + lineHeight + "em;" +
            "font-family:" + "\"" + font + "\";" +
            "'>$&</span>";
    }

    let text: string = node.nodeValue.replace(arabicRegex, newHTML);
    setNodeHtml(node, text);
}

function updateByChanging(node: Node, textSize: number, lineHeight: number, font: string) {
    node.parentElement.style.fontSize = textSize + "em";
    node.parentElement.style.lineHeight = lineHeight + "em";
    if (font === "Original") node.parentElement.style.fontFamily = "";
    else node.parentElement.style.fontFamily = font;
}

/**
 * Updates all Arabic script nodes in this document's body by calling updateNode() on each node in this document
 * with Arabic script
 * @param textSize the size to update the text to
 * @param lineHeight the height to update the line to
 * @param font the name of the font to update the text to
 */
function updateAll(textSize: number, lineHeight: number, font: string = defaultFont) {
    getArabicTextNodesIn(document.body).forEach((it: Node) => updateNode(it, textSize, lineHeight, font));
}

/**
 * Starts the observer that will observe for any additions to the document and update them if they have any
 * Arabic text and they have not been updated yet
 * @param textSize the size to update the text to
 * @param lineHeight the height to update the line to
 * @param font the name of the font to update the text to
 */
function startObserver(textSize: number, lineHeight: number, font: string = defaultFont) {
    // Only do anything if observer is null
    if (!observer) {
        let config: MutationObserverInit = {
            attributes: false, // we don't care about attribute changes
            attributeOldValue: false, // we don't care about attribute changes
            characterData: true, // we get notified of any changes to character data
            characterDataOldValue: true, // we keep the old value
            childList: true, // we get notified about changes to a node's children
            subtree: true, // we get notified about any changes to any of a node's descendants
        };

        let callback: MutationCallback = (mutationsList: MutationRecord[]) => {
            mutationsList.forEach((record: MutationRecord) => {
                // If something has been added
                if (record.addedNodes.length > 0) {

                    //  For each added node
                    record.addedNodes.forEach((addedNode: Node) => {

                        // For each node with Arabic script in addedNode
                        getArabicTextNodesIn(addedNode).forEach((arabicNode: Node) => {
                            updateNode(arabicNode, textSize, lineHeight, font);
                        });
                    });
                }

                // If the value has changed
                if (record.target.nodeValue !== record.oldValue && record.target.parentNode instanceof Node) {

                    // If the node now has Arabic text when it didn't, this is rare and only occurs on YouTube
                    getArabicTextNodesIn(record.target.parentNode).forEach((arabicNode: Node) => {
                        updateNode(arabicNode, textSize, lineHeight, font);
                    });
                }
            });
        };

        observer = new MutationObserver(callback);
        observer.observe(document.body, config);
    }
}

/**
 * Notify the current document that Wudooh has been executed on it.
 * This has no use currently but may be useful later for sites to know if Wudooh is changing their content and for
 * testing
 */
function notifyDocument() {
    let meta = document.createElement("meta");
    meta.setAttribute("wudooh", "true");
    document.head.appendChild(meta);
}

/**
 * Injects the passed in {@linkcode CustomFont}s into this document's head into a new style element
 * @param customFonts the Array of CustomFonts to inject into this document
 */
function injectCustomFonts(customFonts: Array<CustomFont>) {
    let customFontsStyle = get("wudoohCustomFontsStyle");
    if (customFontsStyle) {
        customFontsStyle.innerHTML = "";
        document.head.removeChild(customFontsStyle);
        customFontsStyle = null;
    }
    // Inject custom fonts into this page
    customFontsStyle = document.createElement("style");
    customFontsStyle.id = "wudoohCustomFontsStyle";
    customFonts.forEach((customFont: CustomFont) => {
        const fontName: string = customFont.fontName;
        const fontUrl: string = customFont.url;

        let injectedCss = `@font-face { font-family: '${fontName}'; src: local('${fontName}')`;
        if (fontUrl) injectedCss = injectedCss.concat(`, url('${fontUrl}')`);
        injectedCss = injectedCss.concat(`; }\n`);

        customFontsStyle.innerHTML = customFontsStyle.innerHTML.concat(injectedCss);
    });
    document.head.append(customFontsStyle);
}

/**
 * Listener to update text if options are modified, the options being text size, line height and font
 * Since the original font is not saved, reverting the text to it's original form is not possible
 * This will disconnect the previous observer and start a new one its place with the new options
 * The check whether the switch is on or if this site is whitelisted is not done here but at the
 * sender's sendMessage call
 */
function addMessageListener() {
    runtime.onMessage.addListener((message) => {
        if (!message.reason) return;
        if (message.reason === reasonUpdateAllText) {
            let newSize: number = message.newSize;
            let newHeight: number = message.newHeight;
            updateAll(newSize, newHeight, message.font);

            // If observer was existing then disconnect it and delete it
            if (!!observer) {
                observer.disconnect();
                observer = null;
            }
            startObserver(newSize, newHeight, message.font);
        }
        if (message.reason === reasonInjectCustomFonts) {
            let customFonts: Array<CustomFont> = message.customFonts;
            injectCustomFonts(customFonts);
        }
    });
}

/**
 * Main execution:
 * Updates all existing text according to the options
 * Then starts an observer with those same options to update any new text that will come
 * This only happens if the on off switch is on and the site is not whitelisted
 */
function main() {
    sync.get(keys).then((storage: WudoohStorage) => {
        let textSize: number = storage.textSize;
        let lineHeight: number = storage.lineHeight;
        let isOn: boolean = storage.onOff;
        let font: string = storage.font;
        let whitelisted: Array<string> = storage.whitelisted;
        let customSettings: Array<CustomSettings> = storage.customSettings;
        let customFonts: Array<CustomFont> = storage.customFonts;

        let thisHostname: string = new URL(document.URL).hostname;
        let isWhitelisted: boolean = !!whitelisted.findFirst((it) => it === thisHostname);

        let customSite: CustomSettings = customSettings.findFirst((custom: CustomSettings) => custom.url === thisHostname);

        // Only do anything if the switch is on and this site is not whitelisted
        if (isOn && !isWhitelisted) {

            injectCustomFonts(customFonts);

            // If it's a custom site then change the textSize, lineHeight and font
            if (customSite) {
                textSize = customSite.textSize;
                lineHeight = customSite.lineHeight;
                font = customSite.font;
            }
            let startTime = Date.now();
            updateAll(textSize, lineHeight, font);
            let finishTime = Date.now();
            console.log("Update All took " + (finishTime - startTime));
            startObserver(textSize, lineHeight, font);
            notifyDocument();
        }
    });
    addMessageListener();
}

main();
