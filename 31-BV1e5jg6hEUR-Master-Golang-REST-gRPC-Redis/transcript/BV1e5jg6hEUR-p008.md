[00:00] hi and welcome on this lecture we will start create our first endpoint which will be for sign-up new user or register new user as a matter of fact we will create a new user save it on a database also we will create access token or authentication token name it as you wish using JWT overall
[00:24] For that, let's just start by coming up here. We want to put a secret for this. We should have a secret for this to use it for JWT. We can put this on a constant or a variable or anything like that. But actually the correct way to do this is to create it or undistach it on environment variable. Let's just create a new file. .
[00:51] now we want to name it jnev.t underscore secret and this will equal to we can create a dynamic port using openssl and just say openssl run base64 22 characters
[01:21] okay now let's just copy that and paste it here okay just remove the last one or just leave it anyway just now let's save and next we want to create routes or routes point where we can call it here and start set up our routes one by one
[01:50] for that we just create a new directory we can just call it routes inside of this we can just create a new one we can call it we can actually put this on many routes we just call it auth route or we can put all on just one file we can just do it by this way
[02:19] by this way you can just call it all throughout or we can just call it routes anyway we can start put all in just one file after that we can divide them very well now we can just start by call the package name package routes and have the function we can call it set up routes
[02:47] and this function will take the app which is pointer of fiber app very well after that we can now store the final first route which will be for the auth specifically for register new user can just say app and the method
[03:17] type will be post the pass will be slash user slash sign up alright this should take validation validator user finally we want to call the controller handler for that we can just
[03:46] start write it and call it later controllers and the method name we can name it register all right let's just now copy that and start create a new directory on a root folder call it controllers after that
[04:15] to create a file we can call it AuthController ok now we can just store by say package controllers and we actually can store the docs for that
[04:43] and call the function just say register one down here we can just say func register which will take c of fiber up c tx this will return error roll
[05:13] now we want to get user schema and do many other things ok before that let's just start by we need to call this some more time we need to call it here controllers yes
[05:37] is okay now we need to go back to the main and Actually, you need to start call it here before this auger we can just came here and start say call or set up routes and we can use routes not
[06:05] set up route function and pastore the app first of all after that we need to go to the user model and store create a new model this only just call it in our face or in our faces type can be create user
[06:31] it will be actually a struct and we are only care about the email which will be a string just duplicate this many times also we want to get the password we want to get the first name
[07:00] we want to get also the last name okay and the idea here that we want to get the first name and the last name from the front end part and after that we want to combine them together and put or create this user model
[07:27] now here we need actually to start to write down the comments and just start by say summary we can call it to register a new user can add description just say description register a new user by
[07:57] providing email password just fix this and this as well providing email password first name last name alright after that we want to add tags for this so tags
[08:26] I want to put it on just one tag which will be authentication I call RaskerLat I want to say accept just duplicate this line and change the accept to
[08:54] produce what I call or after that we want to say the param we just came here and say add param the user body models dot just go back to the models create user
[09:23] true and we can just call it user register details after that what if that success we are returning to 101 object of models
[09:49] of user model all right if this failed just come here and save failure this should return kind of 400 object map of string of interface
[10:17] all right and finally we can pass the router we can just say add router this would be slash user slash sign up so we can just come here and say sign up and the method type will be post roll just remove these spaces
[10:46] and we can just start here we can just say for body will be models of create user after that we want to say we want to use body parser for that
[11:10] we can just come here down and say f error equal to c sorry column equal now we are defining a new variable which will of course represent this error c dot status and status can be fiber
[11:38] Bad request, yes it was bad request What else we need to do? No, what the hell we are doing here? Sorry, let's just cut this out Excuse me for confusing
[12:05] we need to come here and say c.bodyPorsor and then we pass pointer of this body and after that we can just say error if not equal to null on that case we can just return c.status
[12:34] and here we can just say fiber dot battery cost status battery cost and then pass the gesso for this also we can just say fiber dot map
[13:02] and first we want to say errors anything just like invalid request body and also we can pass the details we can just come here and say details will be errors not errors
[13:28] past comma and we're good okay what else all right for now let's just copy this return here okay directly paste it here oops oops oops yep yep remove this one and say body and just return the body
[13:58] and we can just say ok status ok for all now let's just hit save and all else we need to do we can just came here start make the swagger documentation after that we can run the app and just say go run main.go ok now let's just open up the app
[14:25] the browser hit on refresh as you can see we got this new one for authentication it just hit on tryout and you just say email anything A at A first name Ahmed Saka or last name Khalaf
[14:52] password let's say ahmed555 or 6x anything hit on execute as you can see here is the response all right response should look like yep when this created but this this is actually the actual response if we change this this will affect it on here why if we remove this email this should return an error
[15:21] hit on execute as you can see error but request the field email the tag is actually required for all it look like that everything works fine now we just go back to the VS code and first let's just start by game here and start by call the user schema so let's just say for user schema
[15:51] this will equal to data bees dot of course this should get it dynamically dot DB collection specifically users all right after that we want to have a contacts so CTX
[16:17] and cancel this will equal to see contacts not constant sorry contacts dot and we can say with timeout
[16:43] after that we can just come here and say contacts background and the time can be 13 times to time dot second all right after all we can just come here and say defer this cancel
[17:11] after we extracting this for now just take this out we can just game down here and store check for if the user exists to the same email for this let's just say check user where this will equal to this user schema not
[17:39] find find one yep all right after that pass the contacts that we already created ctx and use paste on dot d double curly presses inside of it you can just say email or email
[18:08] is equal to this body.email. After that we want to decode this pointer of this body. Alright, what do you have here? So I will suggest key and value.
[18:37] I'm not sure that this is correct. Let me just leave it as it is. Okay. Or, let me just follow this. Anyway. Alright, after that let's just come here and say F Check User. If this is equal to 0.
[19:03] on to return anything for example something like that you just paste that here pet request and inside the fiber map just remove this one and say the message will be something like user with email
[19:32] and we can just come here and add the email as a dynamic part say plus body email plus and we can say already exist okay what after that after that we want to hash to password okay before we create the new name we can just come here
[19:59] and add comment something like hashing password you can just say hash password you just ignore the error you can just use bcrypt
[20:26] and we can use generate from password array of byte okay of this body password and the the hashing will just say 10 hashing number 10 after that we just define the new object
[20:54] of the user, we just call it new user will equal to models dot user model specify the name will be body dot first name plus we just add space close body
[21:22] okay not body dot last name after that the email will be body dot email after that the password will be string of this hash password result after that the followers will be make
[21:51] yes exactly like this suggests to us we want to create it and have just zero as we want to do this with following after all we can just now start insert a new one we can just say result error equal to user schema dot insert
[22:21] one pass the contacts and pass pointer of this new user after that we can just check if error what i call nil you can return anything just copy this one and directly paste
[22:50] here just remove all this and just pass this error okay all right now we have the result this will return to us the inserted id we just test that we can just
[23:18] Come here, take this out, say result. And come here, say result. Inserted ID, hit save. Go back. And let's open up the MongoDB compass. Okay, I didn't have anything yet.
[23:47] I just rerun our app. Take this out. We can just actually from now use air. We are not set up here right now. We want to set up it later for now. Say go run mean.go hit on allow access. Take that out.
[24:14] ok you can just say Ahmad555 and hit on execute this doesn't return anything I'm not sure why you just copy all this ok refresh that on hit on tryout
[24:43] now just paste that hit on execute as you can see it works fine and return to us a result of that ID we need to check out this here just make refresh or just disconnect
[25:11] and reconnect again now we have new new database called social inside of it we have this where we have this hash password email and name ahmed khalaf empty array of followers empty array of following we're all it look like that everything is all fine on the next lecture we will start add or have authentication or access token
[25:41] for our user. So we just do this on the next lecture.
[25:45] Thank you.
