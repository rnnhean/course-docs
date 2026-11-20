[00:00] Now let's work on our rate limiting interceptor and we are going to execute the same functionality that was implemented in REST API just like we have done throughout this GRPC API. We have executed it absolutely the same way as the REST API as much as possible. So now let's copy the rate limiting middleware from our REST API exactly as it was in the REST API to this GRPC API.
[00:27] Let's copy this and then let's work on that. So let's create a new file in the interceptors folder and name this rate limiting dot go. And I'm going to paste everything from the REST API.
[00:55] ratelimiter.go. Great, let's remove these packages and that's it. Alright, so R struct and these methods are going to remain the same but our middleware is going to change now. So this is now going to become rate limit interceptor. So let me create a new function here. And now this middleware is again going to be a method of
[01:24] rate limiter so let's pass a pointer receiver to this method let's copy this from here now in gRPC we pass around context first so the first argument is going to be the context
[01:44] and now the second argument is going to be the request of type interface and next we have the info which is of type grpc.unary server info
[02:07] next we have handler of type grpc.unary handler and now this is going to again return an interface and also an error let me word wrap this great
[02:34] and an error. Now internally the functionality is going to be the same so let's copy all this and I know we have errors and it's going to be a little different but yes the logic is going to be the same but yeah there are a few differences so let's handle them. Now the visitor IP is not going to be accessed this way. What we need to do is
[03:03] we now need to call peer this and access from context method and pass it the context and now this is going to return us a few values let's see what so appear and okay bool value so let's handle them both p comma okay and let's handle the error
[03:31] kind of like an error so if not okay then in that case we are actually going to return an error and this is going to be codes.internal
[03:54] and actually not internal it's going to be unauthenticated because we are unable to get the client IP and now let me delete this and this time we are going to get the visitor IP using p.
[04:23] address dot string there we go now we have the visitor IP let's delete this and now we are going to again send a return value and now in this case if the client is above the rate limit then in that case we are going to send an error
[04:51] And the error code is going to be different. So it's going to be resource exhausted. Great. And we are going to send a message to many requests. Great. Now instead of next dot serve HTTP, we actually
[05:21] return the handler and we pass it the context as well as the request let's delete this and let me add a log message here so log.println
[05:51] and let's differentiate using a few plus signs and then write visitor count from IP
[06:13] now let's pass the argument and it's actually not print ln but print f that's it
[06:42] So our rate limiting interceptor is also done. Let's now use that in the server. And now if we want to use multiple interceptors it's actually pretty easy just separate them by comma inside the chain unary interceptor.
[07:03] arguments. And now we call rate limit interceptor. Let's hit all Z and word wrap. Alright so now we don't have any error.
[07:31] Hit save and our interceptor is applied. You may want to extract interceptors dot new rate limiter outside and then call rate limit interceptor on the instance of this. So let's do that. We are going to use R as an instance of new rate limiter and then call rate limit interceptor on R. Great. So now it is much more readable.
[07:59] Save this and restart the server. And now let's send a request. We are getting a response and we have the visitor count. And now let's send another request and another.
[08:29] and another and another and here we see an error too many requests great because we have only allowed five requests in one minute so no matter how many requests we send after this our API will only accept five requests in one minute and after one minute we can send our subsequent requests just like this
[08:58] Great. So now we are done with our rate limit interceptor as well.
[09:04] Thank you.
