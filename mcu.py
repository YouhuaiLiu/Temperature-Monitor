from gpio import *
from email import *
from time import *
from environment import *

def onEmailReceive(sender, subject, body):
    print("Received from: " + sender)
    print("Subject: " + subject)
    print("Body: " + body)

def onEmailSend(status):
    print("send status: " + str(status))

isLoop = True
count = 0

# Setup the EmailClient outside the loop to avoid repetitive setup
EmailClient.setup(
    "room1@hospital.com",
    "hospital.com",
    "room1",
    "room1"
)
EmailClient.onReceive(onEmailReceive)
EmailClient.onSend(onEmailSend)

while isLoop:
    fire_detector = digitalRead(0)

    # Check for fire detector status
    if fire_detector == 0:
        print("nothing happen")
    elif fire_detector > 38:
        EmailClient.send("room_management@hospital.com", "Temp Notification", "over 38")
        print("Send an error message")
        sleep(3)
    else:
        print("Unknown status: " + str(fire_detector))

    sleep(1)  # Delay for 1 second

    print("I finished " + str(count) + " loop")
    count += 1
