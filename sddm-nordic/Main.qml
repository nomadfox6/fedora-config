import QtQuick 2.15
import QtQuick.Layouts 1.15
import SddmComponents 2.0

Rectangle {
    id: root
    width: Screen.width
    height: Screen.height
    color: "#2E3440"

    // ── Background image (optional) ───────────────────────────────────────────
    Repeater {
        model: screenModel
        Background {
            x: geometry.x; y: geometry.y
            width: geometry.width; height: geometry.height
            source: config.background
            fillMode: Image.PreserveAspectCrop
        }
    }

    Rectangle {
        anchors.fill: parent
        color: "#2E3440"
        opacity: config.background !== "" ? 0.55 : 1.0
    }

    // ── Login card ────────────────────────────────────────────────────────────
    Rectangle {
        id: card
        anchors.centerIn: parent
        width: 380
        height: cardCol.implicitHeight + 64
        color: "#2E3440"
        radius: 12
        border.color: "#88C0D0"
        border.width: 2

        Column {
            id: cardCol
            anchors {
                top: parent.top; left: parent.left; right: parent.right
                topMargin: 32; leftMargin: 32; rightMargin: 32
            }
            spacing: 0

            // hostname
            Text {
                width: parent.width
                text: sddm.hostName
                font.family: "JetBrains Mono"
                font.pixelSize: 28
                font.bold: true
                color: "#ECEFF4"
                horizontalAlignment: Text.AlignHCenter
                bottomPadding: 6
            }

            // date
            Text {
                id: dateText
                width: parent.width
                text: Qt.formatDateTime(new Date(), "dddd, MMMM d")
                font.family: "JetBrains Mono"
                font.pixelSize: 13
                color: "#81A1C1"
                horizontalAlignment: Text.AlignHCenter
                bottomPadding: 28
                Timer {
                    interval: 60000; running: true; repeat: true
                    onTriggered: dateText.text = Qt.formatDateTime(new Date(), "dddd, MMMM d")
                }
            }

            // username field
            Rectangle {
                width: parent.width
                height: 44
                radius: 8
                color: "#3B4252"
                border.color: userInput.activeFocus ? "#88C0D0" : "#4C566A"
                border.width: 2
                clip: true

                Text {
                    anchors { left: parent.left; leftMargin: 14; verticalCenter: parent.verticalCenter }
                    text: "Username"
                    font.family: "JetBrains Mono"
                    font.pixelSize: 14
                    color: "#4C566A"
                    visible: userInput.text === ""
                }

                TextInput {
                    id: userInput
                    anchors { left: parent.left; right: parent.right; leftMargin: 14; rightMargin: 14; verticalCenter: parent.verticalCenter }
                    text: userModel.lastUser
                    font.family: "JetBrains Mono"
                    font.pixelSize: 14
                    color: "#D8DEE9"
                    selectByMouse: true
                    Keys.onTabPressed: passInput.forceActiveFocus()
                    Keys.onReturnPressed: passInput.forceActiveFocus()
                }

                MouseArea {
                    anchors.fill: parent
                    onClicked: userInput.forceActiveFocus()
                }
            }

            Item { width: 1; height: 10 }

            // password field
            Rectangle {
                width: parent.width
                height: 44
                radius: 8
                color: "#3B4252"
                border.color: passInput.activeFocus ? "#88C0D0" : "#4C566A"
                border.width: 2
                clip: true

                Text {
                    anchors { left: parent.left; leftMargin: 14; verticalCenter: parent.verticalCenter }
                    text: "Password"
                    font.family: "JetBrains Mono"
                    font.pixelSize: 14
                    color: "#4C566A"
                    visible: passInput.text === ""
                }

                TextInput {
                    id: passInput
                    anchors { left: parent.left; right: parent.right; leftMargin: 14; rightMargin: 14; verticalCenter: parent.verticalCenter }
                    echoMode: TextInput.Password
                    font.family: "JetBrains Mono"
                    font.pixelSize: 14
                    color: "#D8DEE9"
                    selectByMouse: true
                    Keys.onReturnPressed: doLogin()
                    Keys.onTabPressed: loginBtn.forceActiveFocus()
                }

                MouseArea {
                    anchors.fill: parent
                    onClicked: passInput.forceActiveFocus()
                }
            }

            Item { width: 1; height: 20 }

            // error message
            Text {
                id: errorMsg
                width: parent.width
                text: ""
                visible: text !== ""
                font.family: "JetBrains Mono"
                font.pixelSize: 12
                color: "#BF616A"
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                bottomPadding: visible ? 12 : 0
            }

            // login button
            Rectangle {
                id: loginBtn
                width: parent.width
                height: 42
                radius: 8
                color: loginMA.containsMouse ? "#3B4252" : "transparent"
                border.color: loginMA.containsMouse || loginBtn.activeFocus ? "#88C0D0" : "#4C566A"
                border.width: 2
                activeFocusOnTab: true

                Behavior on color { ColorAnimation { duration: 120 } }
                Behavior on border.color { ColorAnimation { duration: 120 } }

                Text {
                    anchors.centerIn: parent
                    text: "Login"
                    font.family: "JetBrains Mono"
                    font.pixelSize: 14
                    font.bold: true
                    color: loginMA.containsMouse ? "#ECEFF4" : "#D8DEE9"
                }

                MouseArea {
                    id: loginMA
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: doLogin()
                }

                Keys.onReturnPressed: doLogin()
                Keys.onTabPressed: userInput.forceActiveFocus()
            }

            Item { width: 1; height: 32 }
        }
    }

    // ── Clock (bottom-left) ───────────────────────────────────────────────────
    Text {
        id: clockText
        anchors { bottom: parent.bottom; left: parent.left; margins: 24 }
        text: Qt.formatDateTime(new Date(), "HH:mm")
        font.family: "JetBrains Mono"
        font.pixelSize: 32
        font.bold: true
        color: "#ECEFF4"
        Timer {
            interval: 1000; running: true; repeat: true
            onTriggered: clockText.text = Qt.formatDateTime(new Date(), "HH:mm")
        }
    }

    // ── Power buttons (bottom-right) ──────────────────────────────────────────
    Row {
        anchors { bottom: parent.bottom; right: parent.right; margins: 24 }
        spacing: 12

        Rectangle {
            width: 40; height: 40; radius: 20
            color: shutMA.containsMouse ? "#3B4252" : "transparent"
            border.color: shutMA.containsMouse ? "#88C0D0" : "#4C566A"
            border.width: 2
            Behavior on color { ColorAnimation { duration: 120 } }
            Behavior on border.color { ColorAnimation { duration: 120 } }
            Text {
                anchors.centerIn: parent
                text: "⏻"
                font.pixelSize: 16
                color: shutMA.containsMouse ? "#ECEFF4" : "#D8DEE9"
            }
            MouseArea {
                id: shutMA; anchors.fill: parent
                hoverEnabled: true; cursorShape: Qt.PointingHandCursor
                onClicked: sddm.powerOff()
            }
        }

        Rectangle {
            width: 40; height: 40; radius: 20
            color: rebtMA.containsMouse ? "#3B4252" : "transparent"
            border.color: rebtMA.containsMouse ? "#88C0D0" : "#4C566A"
            border.width: 2
            Behavior on color { ColorAnimation { duration: 120 } }
            Behavior on border.color { ColorAnimation { duration: 120 } }
            Text {
                anchors.centerIn: parent
                text: "↺"
                font.pixelSize: 16
                color: rebtMA.containsMouse ? "#ECEFF4" : "#D8DEE9"
            }
            MouseArea {
                id: rebtMA; anchors.fill: parent
                hoverEnabled: true; cursorShape: Qt.PointingHandCursor
                onClicked: sddm.reboot()
            }
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    Connections {
        target: sddm
        function onLoginFailed() {
            errorMsg.text = "Incorrect username or password"
            passInput.text = ""
            passInput.forceActiveFocus()
        }
    }

    function doLogin() {
        errorMsg.text = ""
        sddm.login(userInput.text, passInput.text, sessionModel.lastIndex)
    }

    Component.onCompleted: {
        if (userInput.text === "") userInput.forceActiveFocus()
        else passInput.forceActiveFocus()
    }
}
